""""My document checklist" for signed-in citizens (3rd consultation feature).

A citizen with an account can tick the documents they already have ("I have this"). The ticks
are saved to the account, so the next time they open GinhawAI the checklist is still there and
shows how many documents are ready for each program they may qualify for. Without an account
the ticks only live in the browser tab, as before.

Only the document ids are saved (no names, no files). They are deleted with the account.
"""

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.routers.citizens import current_citizen

router = APIRouter()


class HaveIn(BaseModel):
    have: bool


@router.get("/api/citizen/documents")
async def my_documents(request: Request, me: dict = Depends(current_citizen)):
    """The ids of every document this citizen ticked as 'I have this'."""
    async with request.app.state.db_pool.acquire() as conn:
        rows = await conn.fetch("SELECT doc_id FROM citizen_documents WHERE citizen_id = $1;", me["citizen_id"])
    return {"have": [str(r["doc_id"]) for r in rows]}


@router.put("/api/citizen/documents/{doc_id}", status_code=204)
async def set_document(doc_id: str, body: HaveIn, request: Request, me: dict = Depends(current_citizen)):
    """Tick (have = true) or untick (have = false) one document."""
    async with request.app.state.db_pool.acquire() as conn:
        try:
            if body.have:
                await conn.execute(
                    "INSERT INTO citizen_documents (citizen_id, doc_id) VALUES ($1, $2::uuid) "
                    "ON CONFLICT (citizen_id, doc_id) DO UPDATE SET updated_at = now();",
                    me["citizen_id"], doc_id,
                )
            else:
                await conn.execute("DELETE FROM citizen_documents WHERE citizen_id = $1 AND doc_id = $2::uuid;", me["citizen_id"], doc_id)
        except (asyncpg.ForeignKeyViolationError, asyncpg.DataError):
            raise HTTPException(status_code=404, detail="That document was not found.")
    return Response(status_code=204)


@router.get("/api/citizen/checklist")
async def my_checklist(request: Request, me: dict = Depends(current_citizen)):
    """For the home screen: the programs the citizen may qualify for in their latest check, with
    each program's documents and which ones they already ticked."""
    async with request.app.state.db_pool.acquire() as conn:
        last = await conn.fetchrow(
            "SELECT entities, programs, created_at FROM citizen_assessments WHERE citizen_id = $1 ORDER BY created_at DESC LIMIT 1;",
            me["citizen_id"],
        )
        if last is None:
            return {"checked_on": None, "programs": []}
        names = [p["program_name"] for p in (last["programs"] or []) if p.get("status") in ("qualified", "partial")]
        if not names:
            return {"checked_on": last["created_at"], "programs": []}
        crisis = (last["entities"] or {}).get("crisis_type")
        rows = await conn.fetch(
            "SELECT p.program_name, d.doc_id, d.document_name, d.is_mandatory, d.notes, (cd.doc_id IS NOT NULL) AS have "
            "FROM programs p JOIN document_requirements d ON d.program_id = p.program_id "
            "LEFT JOIN citizen_documents cd ON cd.doc_id = d.doc_id AND cd.citizen_id = $1 "
            "WHERE p.is_active AND p.program_name = ANY($2::text[]) AND (d.for_crisis IS NULL OR d.for_crisis = $3::text) "  # same rule as the results page
            "ORDER BY p.program_name, d.is_mandatory DESC, d.document_name;",
            me["citizen_id"], names, crisis,
        )
    programs: dict[str, list] = {n: [] for n in names}
    for r in rows:
        programs[r["program_name"]].append(
            {"doc_id": str(r["doc_id"]), "document_name": r["document_name"], "is_mandatory": r["is_mandatory"], "notes": r["notes"], "have": r["have"]}
        )
    return {
        "checked_on": last["created_at"],
        "programs": [
            {"program_name": n, "ready": sum(1 for d in docs if d["have"]), "total": len(docs), "documents": docs}
            for n, docs in programs.items() if docs
        ],
    }
