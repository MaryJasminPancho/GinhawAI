from fastapi import APIRouter, Depends, HTTPException, Request

from app.audit import write_audit
from app.auth import create_access_token, get_current_admin, verify_password
from app.schemas import LoginRequest
from app.settings import get_settings

router = APIRouter()


@router.post("/api/auth/login")
async def login(credentials: LoginRequest, request: Request):
    settings = get_settings(request)
    async with request.app.state.db_pool.acquire() as conn:
        user = await conn.fetchrow(
            "SELECT au.user_id, au.password_hash, au.is_active, r.role_name "
            "FROM admin_users au JOIN roles r ON au.role_id = r.role_id "
            "WHERE lower(au.username) = lower($1);",
            credentials.username.strip(),
        )
        if user is None or not user["is_active"]:
            raise HTTPException(status_code=401, detail="Invalid username or password")

        # Lockout after repeated failures since the last successful sign-in (Security Policy screen).
        lockout = int(settings.get("lockout_minutes", 15))
        failures = await conn.fetchval(
            "SELECT COUNT(*) FROM audit_logs WHERE user_id = $1 AND action_type = 'FAILED_LOGIN' "
            "AND timestamp > NOW() - make_interval(mins => $2) "
            "AND timestamp > COALESCE((SELECT MAX(timestamp) FROM audit_logs WHERE user_id = $1 AND action_type = 'LOGIN'), 'epoch');",
            user["user_id"], lockout,
        )
        if failures >= int(settings.get("max_failed_logins", 5)):
            raise HTTPException(status_code=429, detail=f"Too many failed attempts. Try again in {lockout} minutes or ask a System Administrator.")

        if not verify_password(credentials.password, user["password_hash"]):
            client = request.client.host if request.client else "unknown"
            await write_audit(conn, user["user_id"], "FAILED_LOGIN", "admin_users", None, f"Invalid password from {client}")
            raise HTTPException(status_code=401, detail="Invalid username or password")

        await conn.execute("UPDATE admin_users SET last_login = NOW() WHERE user_id = $1;", user["user_id"])
        await write_audit(conn, user["user_id"], "LOGIN", "admin_users", None, "Signed in")

    token = create_access_token(str(user["user_id"]), user["role_name"], int(settings.get("jwt_expire_minutes", 60)))
    return {"access_token": token, "token_type": "bearer", "role": user["role_name"]}


@router.get("/api/auth/me")
async def read_current_admin(current_admin: dict = Depends(get_current_admin)):
    return {"user_id": current_admin["sub"], "role": current_admin["role"], "username": current_admin["username"]}


@router.post("/api/auth/logout")
async def logout(request: Request, current_admin: dict = Depends(get_current_admin)):
    async with request.app.state.db_pool.acquire() as conn:
        await write_audit(conn, current_admin["sub"], "LOGOUT", "admin_users", None, "Signed out")
    return {"ok": True}
