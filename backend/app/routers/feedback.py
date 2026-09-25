from fastapi import APIRouter, Request, Depends, HTTPException

from app.schemas import FeedbackCreate
from app.auth import get_current_admin

router = APIRouter()

# Admin-only endpoint — only System Administrators can view submitted feedback.
@router.get("/api/feedback")
async def list_feedback(request: Request, current_admin: dict = Depends(get_current_admin)):
    if current_admin["role"] != "System Administrator":
        raise HTTPException(status_code=403, detail="Only System Administrators can view feedback")

    async with request.app.state.db_pool.acquire() as conn:
        rows = await conn.fetch("SELECT * FROM feedback_logs ORDER BY submitted_at DESC;")
    return [dict(row) for row in rows]