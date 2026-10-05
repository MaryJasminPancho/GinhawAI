import secrets
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app import secretbox
from app.audit import write_audit
from app.auth import SYSADMIN_ROLES, hash_password, require_roles, verify_password
from app.profile import clean_full_name
from app.schemas import PasswordDecisionIn, RevealIn, RevealPinIn, StaffCreate, StaffUpdate
from app.settings import get_settings

router = APIRouter()
sysadmin = require_roles(SYSADMIN_ROLES)

SELECT_USERS = (
    "SELECT au.user_id, au.username, au.full_name, r.role_name, au.office_id, au.is_active, au.last_login, au.must_change_password, "
    "au.avatar IS NOT NULL AS has_avatar, au.avatar_updated_at "
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
    min_len = int(get_settings(request).get("password_min_length", 8))
    if len(body.password) < min_len:
        raise HTTPException(status_code=422, detail=f"Password must be at least {min_len} characters")
    full_name = clean_full_name(body.full_name)
    async with request.app.state.db_pool.acquire() as conn:
        role_id = await conn.fetchval("SELECT role_id FROM roles WHERE role_name = $1;", body.role_name)
        if role_id is None:
            raise HTTPException(status_code=422, detail=f"Role '{body.role_name}' doesn't exist")
        try:
            async with conn.transaction():
                user_id = await conn.fetchval(
                    # The password given here is temporary: the person must set their own on first sign-in.
                    "INSERT INTO admin_users (username, password_hash, role_id, office_id, full_name, must_change_password) "
                    "VALUES ($1, $2, $3, $4::uuid, $5, TRUE) RETURNING user_id;",
                    body.username, hash_password(body.password), role_id, body.office_id, full_name,
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
            if "full_name" in body.model_fields_set:
                await conn.execute("UPDATE admin_users SET full_name = $1 WHERE user_id = $2;", clean_full_name(body.full_name), user_id)
            after = await conn.fetchrow(SELECT_USERS + "WHERE au.user_id = $1;", user_id)
            await write_audit(conn, current_admin["sub"], "UPDATE", "admin_users",
                              f"{before['username']}: {before['full_name'] or '(no name)'}, {before['role_name']}, office {before['office_id']}",
                              f"{after['username']}: {after['full_name'] or '(no name)'}, {after['role_name']}, office {after['office_id']}")
    return dict(after)


@router.get("/api/admin-users/{user_id}/avatar")
async def staff_avatar(user_id: UUID, request: Request, current_admin: dict = Depends(sysadmin)):
    async with request.app.state.db_pool.acquire() as conn:
        row = await conn.fetchrow("SELECT avatar, avatar_mime FROM admin_users WHERE user_id = $1;", user_id)
    if row is None or row["avatar"] is None:
        raise HTTPException(status_code=404, detail="No profile picture")
    return Response(content=bytes(row["avatar"]), media_type=row["avatar_mime"], headers={"Cache-Control": "private, no-store"})


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
            # A reset password is temporary too: the person must set their own on next sign-in.
            username = await conn.fetchval(
                "UPDATE admin_users SET password_hash = $2, tokens_valid_after = NOW(), must_change_password = TRUE "
                "WHERE user_id = $1 RETURNING username;",
                user_id, hash_password(temp),
            )
            if username is None:
                raise HTTPException(status_code=404, detail="Admin user not found")
            await conn.execute(
                "UPDATE password_change_requests SET status = 'cancelled', decided_at = NOW(), new_password_encrypted = NULL "
                "WHERE user_id = $1 AND status = 'pending';",
                user_id,
            )
            await write_audit(conn, current_admin["sub"], "UPDATE", "admin_users", None, f"{username}: password reset, sessions revoked")
    # Shown once to the System Administrator; only the bcrypt hash is stored.
    return {"temporary_password": temp}


# ---------------------------------------------------------------------------
# Password change requests — approved or rejected by a System Administrator
# ---------------------------------------------------------------------------
@router.get("/api/admin-users/password-requests")
async def list_password_requests(request: Request, status: str = "pending", current_admin: dict = Depends(sysadmin)):
    if status not in ("pending", "approved", "rejected", "all"):
        raise HTTPException(status_code=422, detail="status must be pending, approved, rejected or all")
    # "all" means every decided or pending request (cancelled ones are noise).
    statuses = ["pending", "approved", "rejected"] if status == "all" else [status]
    async with request.app.state.db_pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT pr.request_id, pr.user_id, au.username, r.role_name, pr.reason, pr.status, pr.requested_at, "
            "pr.decided_at, pr.decision_note, d.username AS decided_by "
            "FROM password_change_requests pr "
            "JOIN admin_users au ON au.user_id = pr.user_id JOIN roles r ON r.role_id = au.role_id "
            "LEFT JOIN admin_users d ON d.user_id = pr.decided_by "
            "WHERE pr.status = ANY($1::text[]) ORDER BY pr.requested_at DESC LIMIT 200;",
            statuses,
        )
    return [dict(r) for r in rows]


async def _load_pending(conn, request_id: UUID, current_admin: dict):
    req = await conn.fetchrow(
        "SELECT pr.request_id, pr.user_id, pr.new_password_hash, pr.status, au.username "
        "FROM password_change_requests pr JOIN admin_users au ON au.user_id = pr.user_id "
        "WHERE pr.request_id = $1 FOR UPDATE OF pr;",
        request_id,
    )
    if req is None:
        raise HTTPException(status_code=404, detail="Request not found")
    if req["status"] != "pending":
        raise HTTPException(status_code=409, detail=f"This request was already {req['status']}.")
    if str(req["user_id"]) == current_admin["sub"]:
        raise HTTPException(status_code=403, detail="You can't approve or reject your own password request. Another System Administrator must do it.")
    return req


@router.post("/api/admin-users/password-requests/{request_id}/approve")
async def approve_password_request(request_id: UUID, body: PasswordDecisionIn, request: Request, current_admin: dict = Depends(sysadmin)):
    async with request.app.state.db_pool.acquire() as conn:
        async with conn.transaction():
            req = await _load_pending(conn, request_id, current_admin)
            # Apply the new password and sign the person out everywhere, so they sign in with it.
            await conn.execute(
                "UPDATE admin_users SET password_hash = $2, must_change_password = FALSE, tokens_valid_after = NOW() WHERE user_id = $1;",
                req["user_id"], req["new_password_hash"],
            )
            await conn.execute(
                "UPDATE password_change_requests SET status = 'approved', decided_by = $2::uuid, decided_at = NOW(), decision_note = $3, "
                "new_password_encrypted = NULL WHERE request_id = $1;",
                request_id, current_admin["sub"], (body.note or "").strip() or None,
            )
            await write_audit(conn, current_admin["sub"], "UPDATE", "admin_users", None, f"{req['username']}: password change approved, sessions revoked")
    return {"status": "approved"}


@router.post("/api/admin-users/password-requests/{request_id}/reject")
async def reject_password_request(request_id: UUID, body: PasswordDecisionIn, request: Request, current_admin: dict = Depends(sysadmin)):
    note = (body.note or "").strip()
    if not note:
        raise HTTPException(status_code=422, detail="Tell the person why, so they know what to fix.")
    async with request.app.state.db_pool.acquire() as conn:
        async with conn.transaction():
            req = await _load_pending(conn, request_id, current_admin)
            await conn.execute(
                "UPDATE password_change_requests SET status = 'rejected', decided_by = $2::uuid, decided_at = NOW(), decision_note = $3, "
                "new_password_encrypted = NULL WHERE request_id = $1;",
                request_id, current_admin["sub"], note,
            )
            await write_audit(conn, current_admin["sub"], "UPDATE", "password_change_requests", None, f"{req['username']}: password change rejected ({note})")
    return {"status": "rejected"}


# ---------------------------------------------------------------------------
# Viewing a requested password — protected by the System Administrator's own
# 4-digit PIN, with a lockout after repeated wrong PINs. Every view is audited.
# ---------------------------------------------------------------------------
MAX_PIN_FAILS = 5
PIN_LOCK_MINUTES = 15


@router.get("/api/admin-users/reveal-pin")
async def reveal_pin_status(request: Request, current_admin: dict = Depends(sysadmin)):
    async with request.app.state.db_pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT reveal_pin_hash IS NOT NULL AS has_pin, "
            "CASE WHEN reveal_pin_locked_until > NOW() THEN reveal_pin_locked_until END AS locked_until "
            "FROM admin_users WHERE user_id = $1::uuid;",
            current_admin["sub"],
        )
    return dict(row)


@router.put("/api/admin-users/reveal-pin")
async def set_reveal_pin(body: RevealPinIn, request: Request, current_admin: dict = Depends(sysadmin)):
    async with request.app.state.db_pool.acquire() as conn:
        current_hash = await conn.fetchval("SELECT password_hash FROM admin_users WHERE user_id = $1::uuid;", current_admin["sub"])
        if not verify_password(body.current_password, current_hash):
            raise HTTPException(status_code=400, detail="Your account password is incorrect.")
        async with conn.transaction():
            await conn.execute(
                "UPDATE admin_users SET reveal_pin_hash = $2, reveal_pin_failed = 0, reveal_pin_locked_until = NULL WHERE user_id = $1::uuid;",
                current_admin["sub"], hash_password(body.pin),
            )
            await write_audit(conn, current_admin["sub"], "UPDATE", "admin_users", None, f"{current_admin['username']}: set password-view PIN")
    return {"has_pin": True}


@router.post("/api/admin-users/password-requests/{request_id}/reveal")
async def reveal_requested_password(request_id: UUID, body: RevealIn, request: Request, current_admin: dict = Depends(sysadmin)):
    me = current_admin["sub"]
    async with request.app.state.db_pool.acquire() as conn:
        pin = await conn.fetchrow(
            "SELECT reveal_pin_hash, reveal_pin_failed, reveal_pin_locked_until, "
            "COALESCE(reveal_pin_locked_until > NOW(), FALSE) AS locked FROM admin_users WHERE user_id = $1::uuid;",
            me,
        )
        if pin["reveal_pin_hash"] is None:
            raise HTTPException(status_code=409, detail="Set your 4-digit PIN first.")
        if pin["locked"]:
            raise HTTPException(status_code=429, detail=f"Too many wrong PINs. Try again in {PIN_LOCK_MINUTES} minutes.")

        if not verify_password(body.pin, pin["reveal_pin_hash"]):
            fails = pin["reveal_pin_failed"] + 1
            async with conn.transaction():
                if fails >= MAX_PIN_FAILS:
                    await conn.execute(
                        "UPDATE admin_users SET reveal_pin_failed = 0, reveal_pin_locked_until = NOW() + make_interval(mins => $2) WHERE user_id = $1::uuid;",
                        me, PIN_LOCK_MINUTES,
                    )
                else:
                    await conn.execute("UPDATE admin_users SET reveal_pin_failed = $2 WHERE user_id = $1::uuid;", me, fails)
                await write_audit(conn, me, "FAILED_PIN", "password_change_requests", None,
                                  f"{current_admin['username']}: wrong PIN when viewing a requested password ({fails}/{MAX_PIN_FAILS})")
            if fails >= MAX_PIN_FAILS:
                raise HTTPException(status_code=429, detail=f"Too many wrong PINs. Viewing is locked for {PIN_LOCK_MINUTES} minutes.")
            left = MAX_PIN_FAILS - fails
            raise HTTPException(status_code=403, detail=f"Wrong PIN. {left} {'try' if left == 1 else 'tries'} left.")

        await conn.execute("UPDATE admin_users SET reveal_pin_failed = 0, reveal_pin_locked_until = NULL WHERE user_id = $1::uuid;", me)
        req = await conn.fetchrow(
            "SELECT pr.status, pr.new_password_encrypted, au.username FROM password_change_requests pr "
            "JOIN admin_users au ON au.user_id = pr.user_id WHERE pr.request_id = $1;",
            request_id,
        )
        if req is None:
            raise HTTPException(status_code=404, detail="Request not found")
        if req["status"] != "pending" or req["new_password_encrypted"] is None:
            raise HTTPException(status_code=409, detail="This request is no longer waiting for approval, so its password was erased.")
        password = secretbox.decrypt(req["new_password_encrypted"])
        if password is None:
            raise HTTPException(status_code=409, detail="This password can't be read (the backend's secret key changed). Ask the person to submit it again.")
        await write_audit(conn, me, "VIEW_PASSWORD", "password_change_requests", None, f"{current_admin['username']} viewed {req['username']}'s requested password")
    return {"password": password}
