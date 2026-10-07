from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, Response

from app import secretbox, sms_codes
from app.audit import write_audit
from app.auth import SYSTEM_ADMIN, create_access_token, get_current_admin, hash_password, verify_password
from app.profile import clean_full_name, decode_avatar
from app.mailer import mask_email, normalize_email, send_email
from app.schemas import AvatarIn, CodeIn, EmailIn, ForgotCompleteIn, ForgotStartIn, LoginRequest, MobileIn, PasswordRequestIn, ProfileUpdate
from app.sms import SMS_FEATURE_ENABLED, normalize_ph_number, send_sms
from app.settings import get_settings

router = APIRouter()


@router.post("/api/auth/login")
async def login(credentials: LoginRequest, request: Request):
    settings = get_settings(request)
    async with request.app.state.db_pool.acquire() as conn:
        user = await conn.fetchrow(
            "SELECT au.user_id, au.password_hash, au.is_active, au.must_change_password, r.role_name "
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
    return {"access_token": token, "token_type": "bearer", "role": user["role_name"], "must_change_password": user["must_change_password"]}


@router.get("/api/auth/me")
async def read_current_admin(current_admin: dict = Depends(get_current_admin)):
    return {
        "user_id": current_admin["sub"],
        "role": current_admin["role"],
        "username": current_admin["username"],
        "must_change_password": current_admin["must_change_password"],
    }


@router.post("/api/auth/logout")
async def logout(request: Request, current_admin: dict = Depends(get_current_admin)):
    async with request.app.state.db_pool.acquire() as conn:
        await write_audit(conn, current_admin["sub"], "LOGOUT", "admin_users", None, "Signed out")
    return {"ok": True}


# ---------------------------------------------------------------------------
# Change own password — every change needs a System Administrator's approval.
# ---------------------------------------------------------------------------
REQUEST_COLS = "request_id, reason, status, requested_at, decided_at, decision_note"


def password_problems(password: str, min_len: int) -> list[str]:
    """Rules for a password a staff member chooses. Empty list = acceptable."""
    problems = []
    if len(password) < min_len:
        problems.append(f"be at least {min_len} characters long")
    if not (password[:1].isalpha() and password[:1].isupper()):
        problems.append("start with a capital letter")
    if not any(not ch.isalnum() and not ch.isspace() for ch in password):
        problems.append("include at least one special character (for example ! @ # $ %)")
    return problems


@router.get("/api/auth/password-request")
async def my_password_request(request: Request, current_admin: dict = Depends(get_current_admin)):
    """The signed-in user's most recent password change request (or null)."""
    async with request.app.state.db_pool.acquire() as conn:
        row = await conn.fetchrow(
            f"SELECT {REQUEST_COLS} FROM password_change_requests WHERE user_id = $1::uuid AND status <> 'cancelled' "
            "ORDER BY requested_at DESC LIMIT 1;",
            current_admin["sub"],
        )
    return {"must_change_password": current_admin["must_change_password"], "request": dict(row) if row else None}


@router.post("/api/auth/password-request", status_code=201)
async def request_password_change(body: PasswordRequestIn, request: Request, current_admin: dict = Depends(get_current_admin)):
    min_len = int(get_settings(request).get("password_min_length", 8))
    problems = password_problems(body.new_password, min_len)
    if problems:
        raise HTTPException(status_code=422, detail="The new password must " + "; ".join(problems) + ".")
    user_id = current_admin["sub"]

    async with request.app.state.db_pool.acquire() as conn:
        current_hash = await conn.fetchval("SELECT password_hash FROM admin_users WHERE user_id = $1::uuid;", user_id)
        if not verify_password(body.current_password, current_hash):
            raise HTTPException(status_code=400, detail="Your current password is incorrect.")
        if verify_password(body.new_password, current_hash):
            raise HTTPException(status_code=422, detail="The new password must be different from your current one.")

        reason = "first_login" if current_admin["must_change_password"] else "voluntary"
        row, auto_apply = await _submit_password_request(conn, user_id, current_admin["username"], current_admin["role"], body.new_password, reason)
    return {"request": dict(row), "applied": auto_apply}


async def _submit_password_request(conn, user_id: str, username: str, role: str, new_password: str, reason: str):
    """Queue a new password for a System Administrator's approval (shared by the
    signed-in change and forgot-password). Returns (request row, applied_now)."""
    new_hash = hash_password(new_password)

    # A System Administrator can't approve their own request. If there is no
    # other active System Administrator, apply it right away so they aren't stuck.
    other_admins = 0
    if role == SYSTEM_ADMIN:
        other_admins = await conn.fetchval(
            "SELECT COUNT(*) FROM admin_users au JOIN roles r ON r.role_id = au.role_id "
            "WHERE r.role_name = $1 AND au.is_active AND au.user_id <> $2::uuid;",
            SYSTEM_ADMIN, user_id,
        )
    auto_apply = role == SYSTEM_ADMIN and other_admins == 0

    async with conn.transaction():
        # Replace any earlier pending request.
        await conn.execute(
            "UPDATE password_change_requests SET status = 'cancelled', decided_at = NOW(), new_password_encrypted = NULL "
            "WHERE user_id = $1::uuid AND status = 'pending';",
            user_id,
        )
        if auto_apply:
            row = await conn.fetchrow(
                "INSERT INTO password_change_requests (user_id, new_password_hash, reason, status, decided_by, decided_at, decision_note) "
                "VALUES ($1::uuid, $2, $3, 'approved', $1::uuid, NOW(), 'Applied automatically: no other active System Administrator to approve it.') "
                f"RETURNING {REQUEST_COLS};",
                user_id, new_hash, reason,
            )
            await conn.execute(
                "UPDATE admin_users SET password_hash = $2, must_change_password = FALSE, tokens_valid_after = NOW() WHERE user_id = $1::uuid;",
                user_id, new_hash,
            )
            await write_audit(conn, user_id, "UPDATE", "admin_users", None,
                              f"{username}: password changed (auto-approved, no other System Administrator)")
        else:
            # Encrypted copy so a System Administrator can view it (with their PIN) before approving.
            row = await conn.fetchrow(
                "INSERT INTO password_change_requests (user_id, new_password_hash, new_password_encrypted, reason) VALUES ($1::uuid, $2, $3, $4) "
                f"RETURNING {REQUEST_COLS};",
                user_id, new_hash, secretbox.encrypt(new_password), reason,
            )
            await write_audit(conn, user_id, "PASSWORD_REQUEST", "password_change_requests", None,
                              f"{username}: new password submitted for approval ({reason.replace('_', ' ')})")
    return row, auto_apply


@router.delete("/api/auth/password-request", status_code=204)
async def cancel_password_request(request: Request, current_admin: dict = Depends(get_current_admin)):
    async with request.app.state.db_pool.acquire() as conn:
        await conn.execute(
            "UPDATE password_change_requests SET status = 'cancelled', decided_at = NOW(), new_password_encrypted = NULL "
            "WHERE user_id = $1::uuid AND status = 'pending';",
            current_admin["sub"],
        )


# ---------------------------------------------------------------------------
# Own profile: display name and profile picture (Manage Profile Dashboard)
# ---------------------------------------------------------------------------
PROFILE_SELECT = (
    "SELECT au.user_id, au.username, au.full_name, r.role_name, o.office_name, au.last_login, "
    "au.avatar IS NOT NULL AS has_avatar, au.avatar_updated_at, "
    "CASE WHEN au.mobile_number IS NULL THEN NULL ELSE left(au.mobile_number, 4) || '****' || right(au.mobile_number, 3) END AS mobile_masked, "
    "au.mobile_verified_at, "
    "CASE WHEN au.email IS NULL THEN NULL ELSE left(au.email, 2) || '***@' || split_part(au.email, '@', 2) END AS email_masked, "
    "au.email_verified_at "
    "FROM admin_users au JOIN roles r ON r.role_id = au.role_id "
    "LEFT JOIN lgu_offices o ON o.office_id = au.office_id WHERE au.user_id = $1::uuid;"
)


@router.get("/api/auth/profile")
async def my_profile(request: Request, current_admin: dict = Depends(get_current_admin)):
    async with request.app.state.db_pool.acquire() as conn:
        row = await conn.fetchrow(PROFILE_SELECT, current_admin["sub"])
    return dict(row)


@router.patch("/api/auth/profile")
async def update_my_profile(body: ProfileUpdate, request: Request, current_admin: dict = Depends(get_current_admin)):
    name = clean_full_name(body.full_name)
    async with request.app.state.db_pool.acquire() as conn:
        async with conn.transaction():
            old = await conn.fetchval("SELECT full_name FROM admin_users WHERE user_id = $1::uuid;", current_admin["sub"])
            await conn.execute("UPDATE admin_users SET full_name = $2 WHERE user_id = $1::uuid;", current_admin["sub"], name)
            if old != name:
                await write_audit(conn, current_admin["sub"], "UPDATE", "admin_users",
                                  f"{current_admin['username']} name: {old or '(none)'}", f"{current_admin['username']} name: {name or '(none)'}")
        row = await conn.fetchrow(PROFILE_SELECT, current_admin["sub"])
    return dict(row)


@router.get("/api/auth/profile/avatar")
async def my_avatar(request: Request, current_admin: dict = Depends(get_current_admin)):
    async with request.app.state.db_pool.acquire() as conn:
        row = await conn.fetchrow("SELECT avatar, avatar_mime FROM admin_users WHERE user_id = $1::uuid;", current_admin["sub"])
    if row is None or row["avatar"] is None:
        raise HTTPException(status_code=404, detail="No profile picture")
    return Response(content=bytes(row["avatar"]), media_type=row["avatar_mime"], headers={"Cache-Control": "private, no-store"})


@router.put("/api/auth/profile/avatar")
async def upload_my_avatar(body: AvatarIn, request: Request, current_admin: dict = Depends(get_current_admin)):
    data, mime = decode_avatar(body.data_url)
    async with request.app.state.db_pool.acquire() as conn:
        async with conn.transaction():
            await conn.execute(
                "UPDATE admin_users SET avatar = $2, avatar_mime = $3, avatar_updated_at = NOW() WHERE user_id = $1::uuid;",
                current_admin["sub"], data, mime,
            )
            await write_audit(conn, current_admin["sub"], "UPDATE", "admin_users", None, f"{current_admin['username']}: updated profile picture")
        row = await conn.fetchrow(PROFILE_SELECT, current_admin["sub"])
    return dict(row)


@router.delete("/api/auth/profile/avatar")
async def remove_my_avatar(request: Request, current_admin: dict = Depends(get_current_admin)):
    async with request.app.state.db_pool.acquire() as conn:
        async with conn.transaction():
            await conn.execute(
                "UPDATE admin_users SET avatar = NULL, avatar_mime = NULL, avatar_updated_at = NOW() WHERE user_id = $1::uuid;",
                current_admin["sub"],
            )
            await write_audit(conn, current_admin["sub"], "UPDATE", "admin_users", None, f"{current_admin['username']}: removed profile picture")
        row = await conn.fetchrow(PROFILE_SELECT, current_admin["sub"])
    return dict(row)


# ---------------------------------------------------------------------------
# Mobile number (needed for "forgot password" codes) — verified by SMS code
# ---------------------------------------------------------------------------
@router.post("/api/auth/profile/mobile")
async def send_mobile_code(body: MobileIn, request: Request, current_admin: dict = Depends(get_current_admin)):
    if not SMS_FEATURE_ENABLED:
        raise HTTPException(status_code=404, detail="SMS isn't available yet. Add an email address instead.")
    number = normalize_ph_number(body.mobile)
    if number is None:
        raise HTTPException(status_code=422, detail="Enter an 11-digit mobile number starting with 09.")
    uid = current_admin["sub"]
    async with request.app.state.db_pool.acquire() as conn:
        if await sms_codes.sent_last_hour(conn, uid, "verify_mobile") >= sms_codes.MAX_PER_HOUR:
            raise HTTPException(status_code=429, detail="Too many codes sent. Please wait an hour and try again.")
        code = await sms_codes.issue(conn, uid, "verify_mobile", number)
        result = await send_sms(get_settings(request), number, f"GinhawAI: your verification code is {code}. It expires in {sms_codes.CODE_TTL_MINUTES} minutes.")
        if result["status"] == "FAILED":
            await conn.execute("UPDATE sms_codes SET expires_at = NOW() WHERE user_id = $1::uuid AND purpose = 'verify_mobile' AND used_at IS NULL;", uid)
            raise HTTPException(status_code=502, detail=f"We couldn't send the text. {result['detail']}")
    return {"sent_to": sms_codes.mask(number)}


@router.post("/api/auth/profile/mobile/verify")
async def verify_mobile(body: CodeIn, request: Request, current_admin: dict = Depends(get_current_admin)):
    uid = current_admin["sub"]
    async with request.app.state.db_pool.acquire() as conn:
        async with conn.transaction():
            row = await sms_codes.check(conn, uid, "verify_mobile", body.code)
            if row is None:
                raise HTTPException(status_code=400, detail="That code is wrong or has expired. Send a new one and try again.")
            await conn.execute(
                "UPDATE admin_users SET mobile_number = $2, mobile_verified_at = NOW() WHERE user_id = $1::uuid;",
                uid, row["target_number"],
            )
            await write_audit(conn, uid, "UPDATE", "admin_users", None, f"{current_admin['username']}: verified mobile number {sms_codes.mask(row['target_number'])}")
        profile = await conn.fetchrow(PROFILE_SELECT, uid)
    return dict(profile)


@router.delete("/api/auth/profile/mobile")
async def remove_mobile(request: Request, current_admin: dict = Depends(get_current_admin)):
    uid = current_admin["sub"]
    async with request.app.state.db_pool.acquire() as conn:
        async with conn.transaction():
            await conn.execute("UPDATE admin_users SET mobile_number = NULL, mobile_verified_at = NULL WHERE user_id = $1::uuid;", uid)
            await write_audit(conn, uid, "UPDATE", "admin_users", None, f"{current_admin['username']}: removed mobile number")
        profile = await conn.fetchrow(PROFILE_SELECT, uid)
    return dict(profile)


# ---------------------------------------------------------------------------
# Email address (free alternative to SMS for "forgot password" codes)
# ---------------------------------------------------------------------------
@router.post("/api/auth/profile/email")
async def send_email_code(body: EmailIn, request: Request, current_admin: dict = Depends(get_current_admin)):
    email = normalize_email(body.email)
    if email is None:
        raise HTTPException(status_code=422, detail="Enter a valid email address, like name@gmail.com.")
    uid = current_admin["sub"]
    async with request.app.state.db_pool.acquire() as conn:
        if await sms_codes.sent_last_hour(conn, uid, "verify_email") >= sms_codes.MAX_PER_HOUR:
            raise HTTPException(status_code=429, detail="Too many codes sent. Please wait an hour and try again.")
        code = await sms_codes.issue(conn, uid, "verify_email", email)
        result = await send_email(
            get_settings(request), email, f"GinhawAI verification code: {code}",
            f"Your GinhawAI verification code is {code}.\n\nIt expires in {sms_codes.CODE_TTL_MINUTES} minutes. "
            "If you didn't ask for this, you can ignore this email.",
        )
        if result["status"] == "FAILED":
            await conn.execute("UPDATE sms_codes SET expires_at = NOW() WHERE user_id = $1::uuid AND purpose = 'verify_email' AND used_at IS NULL;", uid)
            raise HTTPException(status_code=502, detail=f"We couldn't send the email. {result['detail']}")
    return {"sent_to": mask_email(email)}


@router.post("/api/auth/profile/email/verify")
async def verify_email(body: CodeIn, request: Request, current_admin: dict = Depends(get_current_admin)):
    uid = current_admin["sub"]
    async with request.app.state.db_pool.acquire() as conn:
        async with conn.transaction():
            row = await sms_codes.check(conn, uid, "verify_email", body.code)
            if row is None:
                raise HTTPException(status_code=400, detail="That code is wrong or has expired. Send a new one and try again.")
            await conn.execute(
                "UPDATE admin_users SET email = $2, email_verified_at = NOW() WHERE user_id = $1::uuid;",
                uid, row["target_number"],
            )
            await write_audit(conn, uid, "UPDATE", "admin_users", None, f"{current_admin['username']}: verified email {mask_email(row['target_number'])}")
        profile = await conn.fetchrow(PROFILE_SELECT, uid)
    return dict(profile)


@router.delete("/api/auth/profile/email")
async def remove_email(request: Request, current_admin: dict = Depends(get_current_admin)):
    uid = current_admin["sub"]
    async with request.app.state.db_pool.acquire() as conn:
        async with conn.transaction():
            await conn.execute("UPDATE admin_users SET email = NULL, email_verified_at = NULL WHERE user_id = $1::uuid;", uid)
            await write_audit(conn, uid, "UPDATE", "admin_users", None, f"{current_admin['username']}: removed email address")
        profile = await conn.fetchrow(PROFILE_SELECT, uid)
    return dict(profile)


# ---------------------------------------------------------------------------
# Forgot password: code by email (or SMS), then the new password waits for approval
# ---------------------------------------------------------------------------
FORGOT_SENT = (
    "If that account has a verified email address or mobile number, we've sent a 6-digit code to it. It expires in 10 minutes."
    if SMS_FEATURE_ENABLED else
    "If that account has a verified email address, we've sent a 6-digit code to it. It expires in 10 minutes."
)
BAD_CODE = "That code is wrong or has expired. Request a new code and try again."


async def _send_reset_code(pool, settings: dict, user_id, username: str, channel: str, target: str, code: str):
    """Runs after the response is sent, so the reply takes the same time whether or not the account exists."""
    if channel == "email":
        result = await send_email(
            settings, target, f"GinhawAI password reset code: {code}",
            f"Your GinhawAI password reset code is {code}.\n\nIt expires in {sms_codes.CODE_TTL_MINUTES} minutes. "
            "Your new password still needs a System Administrator's approval.\n\n"
            "If you didn't ask for this, ignore this email; your password stays the same.",
        )
        shown = mask_email(target)
    else:
        result = await send_sms(settings, target, f"GinhawAI: your password reset code is {code}. It expires in {sms_codes.CODE_TTL_MINUTES} minutes. Ignore this if you didn't ask for it.")
        shown = sms_codes.mask(target)
    async with pool.acquire() as conn:
        outcome = f"sent to {shown}" if result["status"] != "FAILED" else f"could not be sent ({result['detail']})"
        await write_audit(conn, user_id, "FORGOT_PASSWORD", "admin_users", None, f"{username}: password reset code {outcome}")


@router.post("/api/auth/forgot-password/start")
async def forgot_password_start(body: ForgotStartIn, request: Request, background: BackgroundTasks):
    async with request.app.state.db_pool.acquire() as conn:
        user = await conn.fetchrow(
            "SELECT user_id, username, is_active, mobile_number, mobile_verified_at, email, email_verified_at "
            "FROM admin_users WHERE lower(username) = lower($1);",
            body.username.strip(),
        )
        # Same answer in every case, so this can't be used to find out which usernames exist.
        # A verified email is preferred (free); otherwise a verified mobile number.
        if user and user["is_active"]:
            if user["email"] and user["email_verified_at"]:
                channel, target = "email", user["email"]
            elif SMS_FEATURE_ENABLED and user["mobile_number"] and user["mobile_verified_at"]:
                channel, target = "sms", user["mobile_number"]
            else:
                channel = target = None
            if target and await sms_codes.sent_last_hour(conn, user["user_id"], "forgot_password") < sms_codes.MAX_PER_HOUR:
                code = await sms_codes.issue(conn, user["user_id"], "forgot_password", target)
                background.add_task(_send_reset_code, request.app.state.db_pool, get_settings(request),
                                    user["user_id"], user["username"], channel, target, code)
    return {"message": FORGOT_SENT}


@router.post("/api/auth/forgot-password/complete", status_code=201)
async def forgot_password_complete(body: ForgotCompleteIn, request: Request):
    min_len = int(get_settings(request).get("password_min_length", 8))
    problems = password_problems(body.new_password, min_len)
    if problems:
        raise HTTPException(status_code=422, detail="The new password must " + "; ".join(problems) + ".")
    async with request.app.state.db_pool.acquire() as conn:
        user = await conn.fetchrow(
            "SELECT au.user_id, au.username, au.is_active, au.password_hash, r.role_name "
            "FROM admin_users au JOIN roles r ON r.role_id = au.role_id WHERE lower(au.username) = lower($1);",
            body.username.strip(),
        )
        if user is None or not user["is_active"]:
            raise HTTPException(status_code=400, detail=BAD_CODE)
        uid = str(user["user_id"])
        if await sms_codes.check(conn, uid, "forgot_password", body.code) is None:
            raise HTTPException(status_code=400, detail=BAD_CODE)
        if verify_password(body.new_password, user["password_hash"]):
            raise HTTPException(status_code=422, detail="The new password must be different from your current one.")
        _, applied = await _submit_password_request(conn, uid, user["username"], user["role_name"], body.new_password, "forgot_password")
    return {"applied": applied}
