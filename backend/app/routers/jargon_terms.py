"""Knowledge Base Manager: local words and slang the chat understands
("Edit Regional Bureaucratic Jargon Sets", Appendix R #60 / #21).

Staff add words like "arawan" -> daily-wage work, so citizens can answer in
their own words. Every change is audited and takes effect immediately.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from app import chatflow, jargon
from app.audit import write_audit
from app.auth import WELFARE_EDIT_ROLES, WELFARE_ROLES, require_roles
from app.scoring import VALUE_LABELS

router = APIRouter()
welfare = require_roles(WELFARE_ROLES)
editor = require_roles(WELFARE_EDIT_ROLES)

SLOT_LABELS = {"employment_status": "Work situation", "housing_type": "Housing", "crisis_type": "Crisis", "help_needed": "Help needed"}
# "help_needed" shares some values with "crisis_type" but means something else there
# ("death" = funeral or burial costs), so it has its own labels.
HELP_LABELS = {"none": "nothing right now", "medical": "medicine / hospital", "death": "funeral / burial", "transport": "fare / travel",
               "education": "school expenses", "food": "food", "assistive_device": "wheelchair, hearing aid or other device", "other_help": "something else"}


def _label(slot: str, value: str | None) -> str | None:
    if value is None:
        return None
    return HELP_LABELS.get(value, value) if slot == "help_needed" else VALUE_LABELS.get(value, value)
COLS = "term_id, slot, value, term, created_at"


class TermIn(BaseModel):
    slot: str = Field(pattern=r"^(employment_status|housing_type|crisis_type|help_needed)$")
    value: str = Field(min_length=1, max_length=30)
    term: str = Field(min_length=2, max_length=60)


class TryIn(BaseModel):
    slot: str = Field(pattern=r"^(employment_status|housing_type|crisis_type|help_needed)$")
    text: str = Field(min_length=1, max_length=300)


def _clean(body: TermIn) -> tuple[str, str, str]:
    if body.value not in chatflow.ENUMS[body.slot]:
        raise HTTPException(status_code=422, detail="Unknown answer for this question.")
    term = " ".join(body.term.lower().split())
    if len(term) < 2:
        raise HTTPException(status_code=422, detail="Enter a word or phrase of at least 2 letters.")
    return body.slot, body.value, term


async def _taken(conn, slot: str, term: str, exclude: UUID | None = None):
    return await conn.fetchrow(
        "SELECT value FROM jargon_terms WHERE slot = $1 AND lower(term) = $2 AND ($3::uuid IS NULL OR term_id <> $3);",
        slot, term, exclude,
    )


@router.get("/api/jargon")
async def list_terms(request: Request, current_admin: dict = Depends(welfare)):
    async with request.app.state.db_pool.acquire() as conn:
        rows = await conn.fetch(f"SELECT {COLS} FROM jargon_terms ORDER BY slot, value, term;")
    return {
        "slots": [
            {"slot": s, "label": SLOT_LABELS[s],
             "values": [{"value": v, "label": _label(s, v)} for v in chatflow.ENUMS[s]]}
            for s in jargon.SLOTS
        ],
        "terms": [dict(r) for r in rows],
    }


@router.post("/api/jargon", status_code=201)
async def add_term(body: TermIn, request: Request, current_admin: dict = Depends(editor)):
    slot, value, term = _clean(body)
    pool = request.app.state.db_pool
    async with pool.acquire() as conn:
        async with conn.transaction():
            clash = await _taken(conn, slot, term)
            if clash:
                raise HTTPException(status_code=409, detail=f'"{term}" is already listed as {_label(slot, clash["value"])}.')
            row = await conn.fetchrow(
                f"INSERT INTO jargon_terms (slot, value, term) VALUES ($1, $2, $3) RETURNING {COLS};", slot, value, term
            )
            await write_audit(conn, current_admin["sub"], "INSERT", "jargon_terms", None, f'"{term}" = {SLOT_LABELS[slot]}: {_label(slot, value)}')
    await jargon.load(pool)
    return dict(row)


@router.patch("/api/jargon/{term_id}")
async def update_term(term_id: UUID, body: TermIn, request: Request, current_admin: dict = Depends(editor)):
    slot, value, term = _clean(body)
    pool = request.app.state.db_pool
    async with pool.acquire() as conn:
        async with conn.transaction():
            before = await conn.fetchrow(f"SELECT {COLS} FROM jargon_terms WHERE term_id = $1;", term_id)
            if before is None:
                raise HTTPException(status_code=404, detail="Word not found")
            clash = await _taken(conn, slot, term, term_id)
            if clash:
                raise HTTPException(status_code=409, detail=f'"{term}" is already listed as {_label(slot, clash["value"])}.')
            row = await conn.fetchrow(
                f"UPDATE jargon_terms SET slot = $2, value = $3, term = $4 WHERE term_id = $1 RETURNING {COLS};", term_id, slot, value, term
            )
            await write_audit(conn, current_admin["sub"], "UPDATE", "jargon_terms",
                              f'"{before["term"]}" = {_label(before["slot"], before["value"])}',
                              f'"{term}" = {_label(slot, value)}')
    await jargon.load(pool)
    return dict(row)


@router.delete("/api/jargon/{term_id}", status_code=204)
async def delete_term(term_id: UUID, request: Request, current_admin: dict = Depends(editor)):
    pool = request.app.state.db_pool
    async with pool.acquire() as conn:
        async with conn.transaction():
            before = await conn.fetchrow(f"DELETE FROM jargon_terms WHERE term_id = $1 RETURNING {COLS};", term_id)
            if before is None:
                raise HTTPException(status_code=404, detail="Word not found")
            await write_audit(conn, current_admin["sub"], "DELETE", "jargon_terms",
                              f'"{before["term"]}" = {_label(before["slot"], before["value"])}', None)
    await jargon.load(pool)


@router.post("/api/jargon/try")
async def try_phrase(body: TryIn, current_admin: dict = Depends(welfare)):
    """Let staff check how the chat would read an answer, before or after adding a word."""
    value = chatflow.parse_for_slot(body.slot, body.text, "en", jargon.synonyms())
    return {"value": value, "label": _label(body.slot, value)}
