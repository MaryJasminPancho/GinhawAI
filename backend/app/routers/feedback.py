from uuid import UUID

from fastapi import APIRouter, Request, Depends, HTTPException
from pydantic import BaseModel, Field

from app.schemas import FeedbackCreate
from app.audit import write_audit
from app.auth import WELFARE_EDIT_ROLES, WELFARE_ROLES, get_current_admin, require_roles

router = APIRouter()

# Admin-only endpoint — only System Administrators can view submitted feedback.
@router.get("/api/feedback")
async def list_feedback(request: Request, current_admin: dict = Depends(get_current_admin)):
    if current_admin["role"] != "System Administrator":
        raise HTTPException(status_code=403, detail="Only System Administrators can view feedback")

    async with request.app.state.db_pool.acquire() as conn:
        rows = await conn.fetch("SELECT * FROM feedback_logs ORDER BY submitted_at DESC;")
    return [dict(row) for row in rows]


# ---------------------------------------------------------------------------
# Feedback resolution tracking ("Track Feedback Resolution Status", Appendix R #70).
# Welfare staff mark feedback as seen / acted on and can leave a short note.
# The feedback itself stays anonymous; only the staff side is recorded.
# ---------------------------------------------------------------------------
STATUS_LABELS = {"new": "New", "seen": "Seen", "acted_on": "Acted on"}


class FeedbackStatusIn(BaseModel):
    status: str = Field(pattern=r"^(new|seen|acted_on)$")
    staff_note: str | None = Field(default=None, max_length=1000)


@router.patch("/api/feedback/{feedback_id}/status")
async def update_feedback_status(feedback_id: UUID, body: FeedbackStatusIn, request: Request,
                                 current_admin: dict = Depends(require_roles(WELFARE_EDIT_ROLES))):
    note = (body.staff_note or "").strip() or None
    async with request.app.state.db_pool.acquire() as conn:
        async with conn.transaction():
            before = await conn.fetchrow("SELECT status, staff_note FROM feedback_logs WHERE feedback_id = $1;", feedback_id)
            if before is None:
                raise HTTPException(status_code=404, detail="Feedback not found")
            row = await conn.fetchrow(
                "UPDATE feedback_logs SET status = $2, staff_note = $3, status_updated_at = NOW(), status_updated_by = $4::uuid "
                "WHERE feedback_id = $1 RETURNING feedback_id, status, staff_note, status_updated_at;",
                feedback_id, body.status, note, current_admin["sub"],
            )
            await write_audit(conn, current_admin["sub"], "UPDATE", "feedback_logs",
                              f"feedback {str(feedback_id)[:8]}: {STATUS_LABELS[before['status']]}",
                              f"feedback {str(feedback_id)[:8]}: {STATUS_LABELS[body.status]}" + (" (with note)" if note else ""))
    return dict(row)

