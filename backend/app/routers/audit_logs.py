"""System Audit & Compliance Trail: read-only view of audit_logs with simple
anomaly flags ("Flag Anomalous Access Patterns")."""

from datetime import timedelta, timezone

from fastapi import APIRouter, Depends, Request

from app.auth import WELFARE_ROLES, require_roles

router = APIRouter()
welfare = require_roles(WELFARE_ROLES)

MANILA = timezone(timedelta(hours=8))
BURST_WINDOW = timedelta(minutes=15)
BURST_COUNT = 3


@router.get("/api/audit-logs")
async def list_audit_logs(request: Request, limit: int = 1000, current_admin: dict = Depends(welfare)):
    limit = max(1, min(limit, 5000))
    async with request.app.state.db_pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT a.audit_id, a.user_id, au.username, a.action_type, a.target_table, a.old_value, a.new_value, a.timestamp "
            "FROM audit_logs a JOIN admin_users au ON au.user_id = a.user_id "
            "ORDER BY a.timestamp DESC LIMIT $1;",
            limit,
        )
    logs = [dict(r) for r in rows]

    # Flag 1: several failed sign-ins for the same account within 15 minutes.
    failed = [l for l in logs if l["action_type"] == "FAILED_LOGIN"]
    for l in failed:
        near = [f for f in failed if f["user_id"] == l["user_id"] and abs(f["timestamp"] - l["timestamp"]) <= BURST_WINDOW]
        if len(near) >= BURST_COUNT:
            l["flagged"] = True
            l["flag_reason"] = f"{len(near)} failed sign-ins within 15 minutes"
    # Flag 2: sign-ins or changes late at night (10 PM – 5 AM, Philippine time).
    for l in logs:
        hour = l["timestamp"].astimezone(MANILA).hour
        if not l.get("flagged") and l["action_type"] != "FAILED_LOGIN" and (hour >= 22 or hour < 5):
            l["flagged"] = True
            l["flag_reason"] = "Activity outside office hours"
    return logs
