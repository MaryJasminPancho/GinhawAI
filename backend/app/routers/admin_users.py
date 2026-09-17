from uuid import UUID
from fastapi import APIRouter, Request, Depends, HTTPException

from app.auth import get_current_admin

router = APIRouter()

@router.get("/api/admin-users")
async def list_admin_users(request: Request, current_admin: dict = Depends(get_current_admin)):
    if current_admin["role"] != "System Administrator":
        raise HTTPException(status_code=403, detail="Only System Administrators can view admin accounts")
    async with request.app.state.db_pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT au.user_id, au.username, r.role_name, au.is_active, au.last_login "
            "FROM admin_users au JOIN roles r ON au.role_id = r.role_id;"
        )
    return [dict(row) for row in rows]


@router.patch("/api/admin-users/{user_id}/deactivate")
async def deactivate_admin_user(user_id: UUID, request: Request, current_admin: dict = Depends(get_current_admin)):
    if current_admin["role"] != "System Administrator":
        raise HTTPException(status_code=403, detail="Only System Administrators can deactivate accounts")
    if str(user_id) == current_admin["sub"]:
        raise HTTPException(status_code=400, detail="You cannot deactivate your own account")
    async with request.app.state.db_pool.acquire() as conn:
        row = await conn.fetchrow(
            "UPDATE admin_users SET is_active = FALSE WHERE user_id = $1 RETURNING user_id, username, is_active;",
            user_id,
        )
    if row is None:
        raise HTTPException(status_code=404, detail="Admin user not found")
    return dict(row)