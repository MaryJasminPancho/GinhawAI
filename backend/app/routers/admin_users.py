import secrets
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request

from app.audit import write_audit
from app.auth import SYSADMIN_ROLES, hash_password, require_roles
from app.schemas import StaffCreate, StaffUpdate
from app.settings import get_settings

router = APIRouter()
sysadmin = require_roles(SYSADMIN_ROLES)

SELECT_USERS = (
    "SELECT au.user_id, au.username, r.role_name, au.office_id, au.is_active, au.last_login "
    "FROM admin_users au JOIN roles r ON au.role_id = r.role_id "
)


def _temp_password() -> str:
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789"
    return "".join(secrets.choice(alphabet) for _ in range(14))


@router.get("/api/roles")
async def list_roles(request: Request, current_admin: dict = Depends(sysadmin)):
    async with request.app.state.db_pool.acquire() as conn:
        rows = await conn.fetch("SELECT role_id, role_name, description FROM roles ORDER BY role_name;")
    return [dict(r) for r in rows]


@router.get("/api/admin-users")
async def list_admin_users(request: Request, current_admin: dict = Depends(sysadmin)):
    async with request.app.state.db_pool.acquire() as conn:
        rows = await conn.fetch(SELECT_USERS + "ORDER BY au.is_active DESC, au.username;")
    return [dict(row) for row in rows]


@router.post("/api/admin-users", status_code=201)
async def create_admin_user(body: StaffCreate, request: Request, current_admin: dict = Depends(sysadmin)):
    min_len = int(get_settings(request).get("password_min_length", 10))
    if len(body.password) < min_len:
        raise HTTPException(status_code=422, detail=f"Password must be at least {min_len} characters")
    async with request.app.state.db_pool.acquire() as conn:
        role_id = await conn.fetchval("SELECT role_id FROM roles WHERE role_name = $1;", body.role_name)
        if role_id is None:
            raise HTTPException(status_code=422, detail=f"Role '{body.role_name}' doesn't exist")
        try:
            async with conn.transaction():
                user_id = await conn.fetchval(
                    "INSERT INTO admin_users (username, password_hash, role_id, office_id) VALUES ($1, $2, $3, $4::uuid) RETURNING user_id;",
                    body.username, hash_password(body.password), role_id, body.office_id,
                )
                await write_audit(conn, current_admin["sub"], "INSERT", "admin_users", None, f"{body.username} ({body.role_name})")
        except asyncpg.UniqueViolationError:
            raise HTTPException(status_code=409, detail="That username is already taken")
        except asyncpg.ForeignKeyViolationError:
            raise HTTPException(status_code=422, detail="That office doesn't exist")
        row = await conn.fetchrow(SELECT_USERS + "WHERE au.user_id = $1;", user_id)
    return dict(row)


@router.patch("/api/admin-users/{user_id}")
async def update_admin_user(user_id: UUID, body: StaffUpdate, request: Request, current_admin: dict = Depends(sysadmin)):
    async with request.app.state.db_pool.acquire() as conn:
        before = await conn.fetchrow(SELECT_USERS + "WHERE au.user_id = $1;", user_id)
        if before is None:
            raise HTTPException(status_code=404, detail="Admin user not found")
        async with conn.transaction():
            if body.role_name is not None:
                if str(user_id) == current_admin["sub"] and body.role_name != before["role_name"]:
                    raise HTTPException(status_code=400, detail="You can't change your own role")
                role_id = await conn.fetchval("SELECT role_id FROM roles WHERE role_name = $1;", body.role_name)
                if role_id is None:
                    raise HTTPException(status_code=422, detail="Unknown role")
                await conn.execute("UPDATE admin_users SET role_id = $1 WHERE user_id = $2;", role_id, user_id)
            if "office_id" in body.model_fields_set:
                await conn.execute("UPDATE admin_users SET office_id = $1::uuid WHERE user_id = $2;", body.office_id, user_id)
            after = await conn.fetchrow(SELECT_USERS + "WHERE au.user_id = $1;", user_id)
            await write_audit(conn, current_admin["sub"], "UPDATE", "admin_users",
                              f"{before['username']}: {before['role_name']}, office {before['office_id']}",
                              f"{after['username']}: {after['role_name']}, office {after['office_id']}")
    return dict(after)


async def _set_active(user_id: UUID, active: bool, request: Request, current_admin: dict):
    if str(user_id) == current_admin["sub"] and not active:
        raise HTTPException(status_code=400, detail="You cannot deactivate your own account")
    async with request.app.state.db_pool.acquire() as conn:
        async with conn.transaction():
            # Deactivating also invalidates any token the person still holds.
            row = await conn.fetchrow(
                "UPDATE admin_users SET is_active = $2, "
                "tokens_valid_after = CASE WHEN $2 THEN tokens_valid_after ELSE NOW() END "
                "WHERE user_id = $1 RETURNING user_id, username, is_active;",
                user_id, active,
            )
            if row is None:
                raise HTTPException(status_code=404, detail="Admin user not found")
            await write_audit(conn, current_admin["sub"], "UPDATE", "admin_users",
                              f"{row['username']} is_active={not active}", f"{row['username']} is_active={active}")
    return dict(row)


@router.patch("/api/admin-users/{user_id}/deactivate")
async def deactivate_admin_user(user_id: UUID, request: Request, current_admin: dict = Depends(sysadmin)):
    return await _set_active(user_id, False, request, current_admin)


@router.patch("/api/admin-users/{user_id}/activate")
async def activate_admin_user(user_id: UUID, request: Request, current_admin: dict = Depends(sysadmin)):
    return await _set_active(user_id, True, request, current_admin)


@router.post("/api/admin-users/{user_id}/reset-password")
async def reset_password(user_id: UUID, request: Request, current_admin: dict = Depends(sysadmin)):
    temp = _temp_password()
    async with request.app.state.db_pool.acquire() as conn:
        async with conn.transaction():
            username = await conn.fetchval(
                "UPDATE admin_users SET password_hash = $2, tokens_valid_after = NOW() WHERE user_id = $1 RETURNING username;",
                user_id, hash_password(temp),
            )
            if username is None:
                raise HTTPException(status_code=404, detail="Admin user not found")
            await write_audit(conn, current_admin["sub"], "UPDATE", "admin_users", None, f"{username}: password reset, sessions revoked")
    # Shown once to the System Administrator; only the bcrypt hash is stored.
    return {"temporary_password": temp}
