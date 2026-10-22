"""Hyperlocal program search ("Search Hyperlocal Assistance Programs", Appendix R #36).

Lets citizens browse every active program without doing the assessment chat:
who can apply (in their language), the documents to prepare, upcoming barangay
schedules, and where to go. Public and read-only; nothing about the citizen is
asked or stored.
"""

import re

from fastapi import APIRouter, Request

from app.routers.partners import public_partners
from app.scoring import CRISIS_VALUES, _fmt_requirement, _lang, attribute_label, value_label

router = APIRouter()


def is_barangay_hall(office_name: str) -> bool:
    """A barangay hall only serves its own residents, so it is listed only for its barangay."""
    return bool(re.match(r"(barangay|brgy\.?)\s", office_name, re.I))


@router.get("/api/catalog")
async def program_catalog(request: Request, lang: str = "en"):
    lang = _lang(lang)
    async with request.app.state.db_pool.acquire() as conn:
        programs = await conn.fetch("SELECT program_id, program_name, agency, scope FROM programs WHERE is_active ORDER BY program_name;")
        criteria = await conn.fetch("SELECT program_id, attribute, operator, threshold_value, weight FROM eligibility_criteria ORDER BY weight DESC;")
        docs = await conn.fetch(
            "SELECT program_id, document_name, is_mandatory, notes, for_crisis FROM document_requirements ORDER BY for_crisis NULLS FIRST, is_mandatory DESC, document_name;"
        )
        schedules = await conn.fetch(
            "SELECT s.program_id, s.start_date, s.end_date, s.notes, o.office_name, o.address "
            "FROM barangay_schedules s JOIN lgu_offices o ON o.office_id = s.office_id "
            "WHERE s.end_date >= CURRENT_DATE ORDER BY s.start_date;"
        )
        partners = await public_partners(conn)
        barangays = await conn.fetch("SELECT barangay_code, barangay_name FROM barangays ORDER BY barangay_name;")
        offices = await conn.fetch(
            "SELECT o.office_name, o.address, o.contact_number, o.operating_hours, o.barangay_code, b.barangay_name "
            "FROM lgu_offices o LEFT JOIN barangays b ON b.barangay_code = o.barangay_code ORDER BY o.office_name;"
        )

    def rows_for(rows, pid, fn):
        return [fn(r) for r in rows if r["program_id"] == pid]

    return {
        "programs": [
            {
                "program_id": str(p["program_id"]),
                "program_name": p["program_name"],
                "agency": p["agency"],
                "scope": p["scope"],
                "who_can_apply": rows_for(criteria, p["program_id"], lambda c: {
                    "label": attribute_label(c["attribute"], lang),
                    "requirement": _fmt_requirement(c["attribute"], c["operator"], c["threshold_value"], lang),
                }),
                "documents": rows_for(docs, p["program_id"], lambda d: {
                    "document_name": d["document_name"],
                    "is_mandatory": d["is_mandatory"],
                    "notes": d["notes"],
                    "only_if": value_label(d["for_crisis"], lang) if d["for_crisis"] in CRISIS_VALUES else None,
                }),
                "schedules": rows_for(schedules, p["program_id"], lambda s: {
                    "start_date": s["start_date"].isoformat(), "end_date": s["end_date"].isoformat(),
                    "notes": s["notes"], "office_name": s["office_name"], "address": s["address"],
                }),
            }
            for p in programs
        ],
        "offices": [{**dict(o), "is_barangay_hall": is_barangay_hall(o["office_name"])} for o in offices],
        # For the "Where to go" barangay picker.
        "barangays": [dict(b) for b in barangays],
        "partners": partners,
    }
