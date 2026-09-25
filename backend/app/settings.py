"""Editable platform settings stored in the system_config table.

Values are cached on app.state and refreshed whenever an admin saves them, so
request handlers can read them without a database round trip.
"""

from fastapi import Request

DEFAULTS = {
    "jwt_expire_minutes": 60,
    "password_min_length": 10,
    "max_failed_logins": 5,
    "lockout_minutes": 15,
    "rate_limit_per_minute": 60,
    "session_ttl_minutes": 30,
    "purge_on_session_end": True,
    "allowed_origins": ["http://localhost:3000"],
    "sms_enabled": True,
    "sms_sender_name": "GINHAWAI",
    "sms_api_key": None,
    "sms_api_key_updated_at": None,
}


async def load_settings(pool) -> dict:
    values = dict(DEFAULTS)
    async with pool.acquire() as conn:
        try:
            rows = await conn.fetch("SELECT key, value FROM system_config;")
        except Exception:
            # schema_admin.sql not applied yet — run on defaults.
            return values
    for row in rows:
        values[row["key"]] = row["value"]
    return values


def get_settings(request: Request) -> dict:
    return request.app.state.settings


async def save_settings(request: Request, conn, changes: dict) -> dict:
    for key, value in changes.items():
        await conn.execute(
            "INSERT INTO system_config (key, value, updated_at) VALUES ($1, $2, NOW()) "
            "ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();",
            key, value,
        )
    request.app.state.settings = {**request.app.state.settings, **changes}
    return request.app.state.settings
