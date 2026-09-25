"""LGU Analytics & Visualizations (Fig. 10). Only anonymized aggregates leave
this module — no row here can be traced back to a citizen."""

from datetime import date

from fastapi import APIRouter, Depends, Request

from app.auth import ANALYTICS_ROLES, require_roles

router = APIRouter()
analyst = require_roles(ANALYTICS_ROLES)

TZ = "Asia/Manila"


def month_list(n: int) -> list[str]:
    today = date.today()
    y, m = today.year, today.month
    out = []
    for _ in range(n):
        out.append(f"{y:04d}-{m:02d}")
        m -= 1
        if m == 0:
            y, m = y - 1, 12
    return list(reversed(out))


def _months(n: int) -> int:
    return max(1, min(n, 36))


@router.get("/api/analytics/demand")
async def demand(request: Request, months: int = 12, current_admin: dict = Depends(analyst)):
    n = _months(months)
    ms = month_list(n)
    async with request.app.state.db_pool.acquire() as conn:
        assessments = await conn.fetch(
            f"SELECT to_char(event_timestamp AT TIME ZONE '{TZ}', 'YYYY-MM') AS month, barangay_code, vulnerability_tier AS tier, "
            "COUNT(DISTINCT assessment_id) AS count, "
            "COUNT(DISTINCT assessment_id) FILTER (WHERE program_id IS NULL) AS gap "
            "FROM demand_logs WHERE to_char(event_timestamp AT TIME ZONE 'Asia/Manila', 'YYYY-MM') >= $1 "
            "GROUP BY 1, 2, 3;",
            ms[0],
        )
        matches = await conn.fetch(
            f"SELECT to_char(event_timestamp AT TIME ZONE '{TZ}', 'YYYY-MM') AS month, barangay_code, program_id, vulnerability_tier AS tier, "
            "COUNT(*) AS count FROM demand_logs "
            "WHERE program_id IS NOT NULL AND to_char(event_timestamp AT TIME ZONE 'Asia/Manila', 'YYYY-MM') >= $1 "
            "GROUP BY 1, 2, 3, 4;",
            ms[0],
        )
    return {"months": ms, "assessments": [dict(r) for r in assessments], "matches": [dict(r) for r in matches]}


@router.get("/api/analytics/sms")
async def sms(request: Request, months: int = 12, current_admin: dict = Depends(analyst)):
    ms = month_list(_months(months))
    async with request.app.state.db_pool.acquire() as conn:
        rows = await conn.fetch(
            f"SELECT to_char(sent_at AT TIME ZONE '{TZ}', 'YYYY-MM') AS month, "
            "COUNT(*) FILTER (WHERE delivery_status <> 'FAILED') AS sent, COUNT(*) FILTER (WHERE delivery_status = 'FAILED') AS failed "
            "FROM sms_logs WHERE to_char(sent_at AT TIME ZONE 'Asia/Manila', 'YYYY-MM') >= $1 GROUP BY 1;",
            ms[0],
        )
        recent = await conn.fetch(
            "SELECT s.sms_id, s.masked_recipient, s.program_id, p.program_name, s.delivery_status, s.sent_at "
            "FROM sms_logs s JOIN programs p ON p.program_id = s.program_id ORDER BY s.sent_at DESC LIMIT 25;"
        )
    by_month = {r["month"]: r for r in rows}
    return {
        "months": [{"month": m, "sent": by_month[m]["sent"] if m in by_month else 0, "failed": by_month[m]["failed"] if m in by_month else 0} for m in ms],
        "recent": [dict(r) for r in recent],
    }


@router.get("/api/analytics/feedback")
async def feedback(request: Request, months: int = 12, current_admin: dict = Depends(analyst)):
    ms = month_list(_months(months))
    async with request.app.state.db_pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT feedback_id, sus_score, qualitative_feedback, submitted_at FROM feedback_logs "
            f"WHERE to_char(submitted_at AT TIME ZONE '{TZ}', 'YYYY-MM') >= $1 ORDER BY submitted_at DESC LIMIT 5000;",
            ms[0],
        )
    return [dict(r) for r in rows]


@router.get("/api/analytics/documents")
async def document_deficiency(request: Request, months: int = 12, current_admin: dict = Depends(analyst)):
    ms = month_list(_months(months))
    async with request.app.state.db_pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT d.doc_id, d.document_name, d.program_id, p.program_name, "
            "COUNT(*) FILTER (WHERE NOT c.has_document) AS missing_count, COUNT(*) AS checked_count "
            "FROM document_checks c JOIN document_requirements d ON d.doc_id = c.doc_id JOIN programs p ON p.program_id = d.program_id "
            f"WHERE to_char(c.checked_at AT TIME ZONE '{TZ}', 'YYYY-MM') >= $1 "
            "GROUP BY d.doc_id, d.document_name, d.program_id, p.program_name;",
            ms[0],
        )
    return [dict(r) for r in rows]
