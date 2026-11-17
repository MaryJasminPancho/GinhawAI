"""System Audit & Compliance Trail: read-only view of audit_logs with simple
anomaly flags ("Flag Anomalous Access Patterns").

Flags (worked out each time; audit_logs itself is never changed):
  1. several failed sign-ins for the same account within 15 minutes;
  2. a sign-in late at night (10 PM - 5 AM, Philippine time). Only the sign-in is
     flagged, not every change or the sign-out after it: one flag points the
     System Administrator at the session.
A System Administrator can mark flags as reviewed (kept in audit_flag_reviews, and
audit-logged), so ones already checked, like the team's own late development
sessions, stop showing as alerts.
"""

from datetime import timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from app.audit import write_audit
from app.auth import SYSTEM_ADMIN, get_current_admin, require_roles

router = APIRouter()
sysadmin = require_roles({SYSTEM_ADMIN})

MANILA = timezone(timedelta(hours=8))
BURST_WINDOW = timedelta(minutes=15)
BURST_COUNT = 3
LATE_FROM, LATE_UNTIL = 22, 5  # 10 PM to 5 AM
LATE_REASON = "Late-night sign-in (10 PM – 5 AM)"


class ReviewIn(BaseModel):
    audit_ids: list[UUID] = Field(min_length=1, max_length=2000)


@router.get("/api/audit-logs")
async def list_audit_logs(request: Request, limit: int = 1000, current_admin: dict = Depends(get_current_admin)):
    """System Administrators see everyone's activity; every other staff member
    sees only the actions they performed themselves."""
    limit = max(1, min(limit, 5000))
    see_all = current_admin["role"] == SYSTEM_ADMIN
    async with request.app.state.db_pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT a.audit_id, a.user_id, au.username, a.action_type, a.target_table, a.old_value, a.new_value, a.timestamp, "
            "r.reviewed_at, ru.username AS reviewed_by "
            "FROM audit_logs a JOIN admin_users au ON au.user_id = a.user_id "
            "LEFT JOIN audit_flag_reviews r ON r.audit_id = a.audit_id "
            "LEFT JOIN admin_users ru ON ru.user_id = r.reviewed_by "
            "WHERE $2::boolean OR a.user_id = $3::uuid "
            "ORDER BY a.timestamp DESC LIMIT $1;",
            limit, see_all, current_admin["sub"],
        )
    logs = [dict(r) for r in rows]

    # Flag 1: several failed sign-ins for the same account within 15 minutes.
    failed = [l for l in logs if l["action_type"] == "FAILED_LOGIN"]
    for l in failed:
        near = [f for f in failed if f["user_id"] == l["user_id"] and abs(f["timestamp"] - l["timestamp"]) <= BURST_WINDOW]
        if len(near) >= BURST_COUNT:
            l["flagged"] = True
            l["flag_reason"] = f"{len(near)} failed sign-ins within 15 minutes"
    # Flag 2: a sign-in late at night.
    for l in logs:
        hour = l["timestamp"].astimezone(MANILA).hour
        if not l.get("flagged") and l["action_type"] == "LOGIN" and (hour >= LATE_FROM or hour < LATE_UNTIL):
            l["flagged"] = True
            l["flag_reason"] = LATE_REASON
    for l in logs:
        l["reviewed"] = bool(l.get("flagged") and l["reviewed_at"])
        if not l["reviewed"]:
            l["reviewed_at"] = l["reviewed_by"] = None
    return logs


@router.post("/api/audit-logs/review")
async def review_flags(body: ReviewIn, request: Request, current_admin: dict = Depends(sysadmin)):
    """Mark flagged entries as reviewed (System Administrator only). Already-reviewed ones are skipped."""
    async with request.app.state.db_pool.acquire() as conn:
        async with conn.transaction():
            done = await conn.fetch(
                "INSERT INTO audit_flag_reviews (audit_id, reviewed_by) "
                "SELECT a.audit_id, $2::uuid FROM audit_logs a WHERE a.audit_id = ANY($1::uuid[]) "
                "ON CONFLICT (audit_id) DO NOTHING RETURNING audit_id;",
                body.audit_ids, current_admin["sub"],
            )
            if not done and len(body.audit_ids) == 1:
                exists = await conn.fetchval("SELECT 1 FROM audit_logs WHERE audit_id = $1;", body.audit_ids[0])
                if not exists:
                    raise HTTPException(status_code=404, detail="Entry not found")
            if done:
                await write_audit(conn, current_admin["sub"], "REVIEW", "audit_logs", None,
                                  f"Marked {len(done)} flagged entr{'y' if len(done) == 1 else 'ies'} as reviewed")
    return {"reviewed": len(done)}
