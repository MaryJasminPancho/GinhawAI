from fastapi import APIRouter, Request, Depends, HTTPException

from app.schemas import FeedbackCreate
from app.auth import get_current_admin

router = APIRouter()

# Public endpoint — no login required, matches the manuscript's "anonymous feedback" design.
@router.post("/api/feedback", status_code=201)
async def submit_feedback(payload: FeedbackCreate, request: Request):
    async with request.app.state.db_pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO feedback_logs (sus_score, qualitative_feedback)
            VALUES ($1, $2)
            RETURNING *;
            """,
            payload.sus_score, payload.qualitative_feedback,
        )
    return dict(row)

# Admin-only endpoint — only System Administrators can view submitted feedback.
@router.get("/api/feedback")
async def list_feedback(request: Request, current_admin: dict = Depends(get_current_admin)):
    if current_admin["role"] != "System Administrator":
        raise HTTPException(status_code=403, detail="Only System Administrators can view feedback")

    async with request.app.state.db_pool.acquire() as conn:
        rows = await conn.fetch("SELECT * FROM feedback_logs ORDER BY submitted_at DESC;")
    return [dict(row) for row in rows]