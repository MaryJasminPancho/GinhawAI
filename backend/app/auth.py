from datetime import datetime, timedelta, timezone
import bcrypt
import jwt
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.config import SECRET_KEY, JWT_ALGORITHM, JWT_EXPIRE_MINUTES

security = HTTPBearer()

# Role names (must match the roles table).
SYSTEM_ADMIN = "System Administrator"
LGU_ADMIN = "LGU Administrator"
SOCIAL_WORKER = "Social Worker"
LGU_EXECUTIVE = "LGU Executive"
PARTNER_ORG = "Partner Organization"

# Who may do what — mirrors the use case diagrams (manuscript Figs. 9–11).
WELFARE_ROLES = {SYSTEM_ADMIN, LGU_ADMIN, SOCIAL_WORKER}  # rules, schedules, offices, audit, validation
ANALYTICS_ROLES = {SYSTEM_ADMIN, LGU_ADMIN, SOCIAL_WORKER, LGU_EXECUTIVE, PARTNER_ORG}  # anonymized dashboards
SYSADMIN_ROLES = {SYSTEM_ADMIN}  # accounts, system health, SMS gateway, security policy


def hash_password(plain_password: str) -> str:
    return bcrypt.hashpw(plain_password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), password_hash.encode("utf-8"))


def create_access_token(user_id: str, role_name: str, expire_minutes: int | None = None) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "role": role_name,
        "iat": int(now.timestamp()),
        # Millisecond issue time, so a reset/revoke in the same second still counts.
        "iat_ms": int(now.timestamp() * 1000),
        "exp": now + timedelta(minutes=expire_minutes or JWT_EXPIRE_MINUTES),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=JWT_ALGORITHM)


async def get_current_admin(request: Request, credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    token = credentials.credentials
    try:
        claims = jwt.decode(token, SECRET_KEY, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

    # Reject tokens of deactivated accounts, and tokens issued before a
    # password reset or a "revoke all sessions".
    async with request.app.state.db_pool.acquire() as conn:
        user = await conn.fetchrow(
            "SELECT au.is_active, au.tokens_valid_after, au.username, r.role_name "
            "FROM admin_users au JOIN roles r ON au.role_id = r.role_id WHERE au.user_id = $1::uuid;",
            claims["sub"],
        )
    if user is None or not user["is_active"]:
        raise HTTPException(status_code=401, detail="Account is not active")
    issued_ms = claims.get("iat_ms", claims.get("iat", 0) * 1000)
    if issued_ms < user["tokens_valid_after"].timestamp() * 1000:
        raise HTTPException(status_code=401, detail="Session was revoked. Please sign in again.")
    # Role changes take effect immediately (don't trust the role inside an old token).
    return {**claims, "role": user["role_name"], "username": user["username"]}


def require_roles(allowed: set[str]):
    async def checker(current_admin: dict = Depends(get_current_admin)) -> dict:
        if current_admin["role"] not in allowed:
            raise HTTPException(status_code=403, detail=f"Your role ({current_admin['role']}) can't do this")
        return current_admin

    return checker
