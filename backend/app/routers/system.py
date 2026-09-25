"""System Administrator console (Fig. 11): system health, session cache,
database, SMS gateway tokens and infrastructure security policy."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request

from app.audit import write_audit
from app.auth import SYSADMIN_ROLES, require_roles
from app.config import GEMINI_API_KEY
from app.schemas import CacheTtlIn, SecurityPolicyIn, SmsGatewayUpdate, TestSmsIn
from app.settings import get_settings, save_settings
from app.sms import account_balance, api_key, normalize_ph_number, send_sms

router = APIRouter()
sysadmin = require_roles(SYSADMIN_ROLES)


# ---------------------------------------------------------------------------
# Services (FastAPI / PostgreSQL / Redis are checked by the /health endpoints)
# ---------------------------------------------------------------------------
@router.get("/api/system/services")
async def services(request: Request, current_admin: dict = Depends(sysadmin)):
    s = get_settings(request)
    key = api_key(s)
    balance = await account_balance(s) if key else None
    sms_status = "down" if not key else ("degraded" if not s.get("sms_enabled", True) or balance is None else "up")
    sms_detail = (
        "No API key configured" if not key else
        "Paused by administrator" if not s.get("sms_enabled", True) else
        f"{balance:,} credits left" if balance is not None else "Key set, but the gateway didn't answer"
    )
    return [
        {"name": "NLP extraction (Gemini, stand-in for XLM-RoBERTa)", "status": "up" if GEMINI_API_KEY else "down",
         "detail": "API key configured" if GEMINI_API_KEY else "GEMINI_API_KEY missing — chat falls back to the built-in parser"},
        {"name": "Vulnerability scoring engine", "status": "up", "detail": "Rule-based placeholder (XGBoost pending)"},
        {"name": "Semaphore SMS gateway", "status": sms_status, "detail": sms_detail},
    ]


# ---------------------------------------------------------------------------
# Redis session cache
# ---------------------------------------------------------------------------
async def _session_keys(redis) -> list[str]:
    return [k async for k in redis.scan_iter(match="session:*", count=500)]


@router.get("/api/system/cache")
async def cache_stats(request: Request, current_admin: dict = Depends(sysadmin)):
    redis = request.app.state.redis
    try:
        memory_mb = round(int((await redis.info("memory")).get("used_memory", 0)) / 1048576, 1)
    except Exception:  # some hosted Redis plans disable INFO
        memory_mb = None
    keys = await _session_keys(redis)
    return {
        "active_sessions": len(keys),
        "keys": await redis.dbsize(),
        "memory_mb": memory_mb,
        "ttl_minutes": int(get_settings(request).get("session_ttl_minutes", 30)),
    }


@router.post("/api/system/cache/purge")
async def purge_cache(request: Request, scope: str = "idle", current_admin: dict = Depends(sysadmin)):
    if scope not in ("idle", "all"):
        raise HTTPException(status_code=422, detail="scope must be 'idle' or 'all'")
    redis = request.app.state.redis
    ttl_total = int(get_settings(request).get("session_ttl_minutes", 30)) * 60
    keys = await _session_keys(redis)
    if scope == "idle":
        # Idle = untouched for more than half the timeout (every request refreshes the TTL).
        keys = [k for k in keys if 0 <= await redis.ttl(k) < ttl_total / 2]
    if keys:
        await redis.delete(*keys)
    async with request.app.state.db_pool.acquire() as conn:
        await write_audit(conn, current_admin["sub"], "PURGE", "session_cache", None, f"{len(keys)} {scope} chat sessions purged")
    return {"purged": len(keys), **(await cache_stats(request, current_admin))}


@router.put("/api/system/cache/ttl")
async def set_ttl(body: CacheTtlIn, request: Request, current_admin: dict = Depends(sysadmin)):
    async with request.app.state.db_pool.acquire() as conn:
        async with conn.transaction():
            old = get_settings(request).get("session_ttl_minutes")
            await save_settings(request, conn, {"session_ttl_minutes": body.minutes})
            await write_audit(conn, current_admin["sub"], "UPDATE", "system_config", f"session_ttl_minutes={old}", f"session_ttl_minutes={body.minutes}")
    return {"ttl_minutes": body.minutes}


# ---------------------------------------------------------------------------
# PostgreSQL
# ---------------------------------------------------------------------------
MODULES = {
    "programs": "Welfare Core", "eligibility_criteria": "Welfare Core", "document_requirements": "Welfare Core",
    "barangays": "Localization", "lgu_offices": "Localization", "barangay_schedules": "Localization",
    "demand_logs": "Localization", "sms_logs": "Localization", "document_checks": "Localization",
    "roles": "Management & Security", "admin_users": "Management & Security", "audit_logs": "Management & Security",
    "system_config": "Management & Security",
    "feedback_logs": "Feedback & QA", "validation_cases": "Feedback & QA", "validation_ratings": "Feedback & QA",
}


@router.get("/api/system/database")
async def database_info(request: Request, current_admin: dict = Depends(sysadmin)):
    pool = request.app.state.db_pool
    async with pool.acquire() as conn:
        version = await conn.fetchval("SHOW server_version;")
        size = await conn.fetchval("SELECT pg_database_size(current_database());")
        tables = await conn.fetch(
            "SELECT relname AS table, n_live_tup AS rows, pg_total_relation_size(relid) AS bytes "
            "FROM pg_stat_user_tables ORDER BY relname;"
        )
    return {
        "version": version,
        "size_mb": round(size / 1048576, 1),
        "pool_size": pool.get_size(),
        "pool_idle": pool.get_idle_size(),
        "tables": [{"table": t["table"], "module": MODULES.get(t["table"], "Other"), "rows": t["rows"], "size_kb": round(t["bytes"] / 1024)} for t in tables],
    }


# ---------------------------------------------------------------------------
# Semaphore SMS gateway ("Provision SMS Gateway Access Tokens")
# ---------------------------------------------------------------------------
def _gateway_view(s: dict, balance: int | None) -> dict:
    key = api_key(s)
    source = "admin console" if s.get("sms_api_key") else ("environment variable" if key else None)
    return {
        "sender_name": s.get("sms_sender_name") or "",
        "enabled": bool(s.get("sms_enabled", True)),
        "configured": bool(key),
        "key_source": source,
        "api_key_masked": f"••••••••••••{key[-4:]}" if key else None,
        "key_updated_at": s.get("sms_api_key_updated_at"),
        "credits_remaining": balance,
    }


@router.get("/api/system/sms-gateway")
async def get_gateway(request: Request, current_admin: dict = Depends(sysadmin)):
    s = get_settings(request)
    return _gateway_view(s, await account_balance(s))


@router.patch("/api/system/sms-gateway")
async def update_gateway(body: SmsGatewayUpdate, request: Request, current_admin: dict = Depends(sysadmin)):
    changes: dict = {}
    if body.sender_name is not None:
        changes["sms_sender_name"] = body.sender_name.upper()
    if body.enabled is not None:
        changes["sms_enabled"] = body.enabled
    if body.api_key:
        changes["sms_api_key"] = body.api_key.strip()
        changes["sms_api_key_updated_at"] = datetime.now(timezone.utc).isoformat()
    if not changes:
        raise HTTPException(status_code=422, detail="Nothing to update")
    async with request.app.state.db_pool.acquire() as conn:
        async with conn.transaction():
            await save_settings(request, conn, changes)
            logged = {k: ("(new key)" if k == "sms_api_key" else v) for k, v in changes.items() if k != "sms_api_key_updated_at"}
            await write_audit(conn, current_admin["sub"], "UPDATE", "system_config", None, logged)
    s = get_settings(request)
    return _gateway_view(s, await account_balance(s))


@router.post("/api/system/sms-gateway/test")
async def test_sms(body: TestSmsIn, request: Request, current_admin: dict = Depends(sysadmin)):
    number = normalize_ph_number(body.number)
    if number is None:
        raise HTTPException(status_code=422, detail="Enter an 11-digit mobile number starting with 09")
    result = await send_sms(get_settings(request), number, "GinhawAI test message. The SMS gateway is working.")
    if result["status"] == "FAILED":
        raise HTTPException(status_code=502, detail=result["detail"])
    return result


# ---------------------------------------------------------------------------
# Security policy ("Manage Infrastructure Security Policy")
# ---------------------------------------------------------------------------
POLICY_KEYS = ["jwt_expire_minutes", "password_min_length", "max_failed_logins", "lockout_minutes",
               "rate_limit_per_minute", "allowed_origins", "purge_on_session_end"]


@router.get("/api/system/security-policy")
async def get_policy(request: Request, current_admin: dict = Depends(sysadmin)):
    s = get_settings(request)
    return {k: s.get(k) for k in POLICY_KEYS}


@router.put("/api/system/security-policy")
async def update_policy(body: SecurityPolicyIn, request: Request, current_admin: dict = Depends(sysadmin)):
    new = body.model_dump()
    new["allowed_origins"] = [o.strip().rstrip("/") for o in new["allowed_origins"] if o.strip()]
    if "*" in new["allowed_origins"]:
        raise HTTPException(status_code=422, detail="A wildcard origin isn't allowed")
    s = get_settings(request)
    changed = {k: v for k, v in new.items() if s.get(k) != v}
    async with request.app.state.db_pool.acquire() as conn:
        async with conn.transaction():
            await save_settings(request, conn, changed)
            if changed:
                await write_audit(conn, current_admin["sub"], "UPDATE", "system_config", {k: s.get(k) for k in changed}, changed)
    # Apply CORS changes immediately (the middleware holds a reference to this list).
    origins = request.app.state.cors_origins
    origins[:] = new["allowed_origins"]
    return {k: get_settings(request).get(k) for k in POLICY_KEYS}


@router.post("/api/system/revoke-sessions")
async def revoke_all_sessions(request: Request, current_admin: dict = Depends(sysadmin)):
    async with request.app.state.db_pool.acquire() as conn:
        async with conn.transaction():
            n = await conn.fetchval("WITH u AS (UPDATE admin_users SET tokens_valid_after = NOW() RETURNING 1) SELECT COUNT(*) FROM u;")
            await write_audit(conn, current_admin["sub"], "UPDATE", "admin_users", None, f"All staff sessions revoked ({n} accounts)")
    return {"revoked": n}
