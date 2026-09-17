from fastapi import APIRouter, Request, Depends, HTTPException

from app.schemas import LoginRequest
from app.auth import verify_password, create_access_token, get_current_admin

router = APIRouter()

@router.post("/api/auth/login")
async def login(credentials: LoginRequest, request: Request):
    async with request.app.state.db_pool.acquire() as conn:
        user = await conn.fetchrow(
            "SELECT au.user_id, au.password_hash, au.is_active, r.role_name "
            "FROM admin_users au JOIN roles r ON au.role_id = r.role_id "
            "WHERE au.username = $1;",
            credentials.username,
        )

    if user is None or not user["is_active"]:
        raise HTTPException(status_code=401, detail="Invalid username or password")

    if not verify_password(credentials.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    async with request.app.state.db_pool.acquire() as conn:
        await conn.execute("UPDATE admin_users SET last_login = NOW() WHERE user_id = $1;", user["user_id"])

    token = create_access_token(str(user["user_id"]), user["role_name"])
    return {"access_token": token, "token_type": "bearer"}


@router.get("/api/auth/me")
async def read_current_admin(current_admin: dict = Depends(get_current_admin)):
    return {"user_id": current_admin["sub"], "role": current_admin["role"]}