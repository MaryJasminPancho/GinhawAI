"""One-time 6-digit codes sent by SMS or email (verifying a mobile number or an
email address, and forgot password). The table is still called sms_codes.

Only a keyed hash of each code is stored. A code expires after 10 minutes,
allows 5 wrong tries, and a person can be sent at most 3 codes per hour for
the same purpose.
"""

import hashlib
import hmac
import secrets

from app.config import SECRET_KEY

CODE_TTL_MINUTES = 10
MAX_ATTEMPTS = 5
MAX_PER_HOUR = 3


def _hash(user_id: str, purpose: str, code: str) -> str:
    return hmac.new(SECRET_KEY.encode(), f"{user_id}:{purpose}:{code}".encode(), hashlib.sha256).hexdigest()


async def sent_last_hour(conn, user_id: str, purpose: str) -> int:
    return await conn.fetchval(
        "SELECT COUNT(*) FROM sms_codes WHERE user_id = $1::uuid AND purpose = $2 AND created_at > NOW() - INTERVAL '1 hour';",
        user_id, purpose,
    )


async def issue(conn, user_id: str, purpose: str, number: str) -> str:
    """Create a new code (cancelling any earlier unused one) and return it for sending."""
    code = f"{secrets.randbelow(10**6):06d}"
    await conn.execute(
        "UPDATE sms_codes SET expires_at = NOW() WHERE user_id = $1::uuid AND purpose = $2 AND used_at IS NULL AND expires_at > NOW();",
        user_id, purpose,
    )
    await conn.execute(
        "INSERT INTO sms_codes (user_id, purpose, code_hash, target_number, expires_at) "
        "VALUES ($1::uuid, $2, $3, $4, NOW() + make_interval(mins => $5));",
        user_id, purpose, _hash(str(user_id), purpose, code), number, CODE_TTL_MINUTES,
    )
    return code


async def check(conn, user_id: str, purpose: str, code: str):
    """Return the code row if `code` is right (and mark it used); otherwise None."""
    row = await conn.fetchrow(
        "SELECT code_id, code_hash, target_number, attempts FROM sms_codes "
        "WHERE user_id = $1::uuid AND purpose = $2 AND used_at IS NULL AND expires_at > NOW() "
        "ORDER BY created_at DESC LIMIT 1;",
        user_id, purpose,
    )
    if row is None or row["attempts"] >= MAX_ATTEMPTS:
        return None
    if not hmac.compare_digest(row["code_hash"], _hash(str(user_id), purpose, code.strip())):
        await conn.execute("UPDATE sms_codes SET attempts = attempts + 1 WHERE code_id = $1;", row["code_id"])
        return None
    await conn.execute("UPDATE sms_codes SET used_at = NOW() WHERE code_id = $1;", row["code_id"])
    return row


def mask(number: str | None) -> str | None:
    return f"{number[:4]}****{number[-3:]}" if number else None
