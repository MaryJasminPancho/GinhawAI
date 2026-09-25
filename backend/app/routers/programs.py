"""Welfare Core: programs, eligibility criteria and document requirements.

Reads are public (the citizen app uses them). Changes are for Authorized
Welfare Personnel — LGU Administrators, Social Workers and System
Administrators ("Manage Program Rules Matrix", Fig. 9) — and every change is
written to the audit trail.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request

from app.audit import write_audit
from app.auth import WELFARE_ROLES, require_roles
from app.schemas import DocumentRequirementCreate, EligibilityCriteriaCreate, ProgramCreate, ProgramUpdate
from app.scoring import ATTRIBUTE_LABELS, COMPUTED_ATTRIBUTES

router = APIRouter()
welfare = require_roles(WELFARE_ROLES)

PROGRAM_COLS = "program_id, program_name, agency, scope, is_active"
CRITERIA_COLS = "criteria_id, program_id, attribute, operator, threshold_value, weight"
DOC_COLS = "doc_id, program_id, document_name, is_mandatory, notes"


def _rule_text(r) -> str:
    return f"{r['attribute']} {r['operator']} {r['threshold_value']} (weight {float(r['weight']):.2f})"


# ---------------------------------------------------------------------------
# Reads (public)
# ---------------------------------------------------------------------------
@router.get("/api/programs")
async def list_programs(request: Request, active_only: bool = False):
    where = "WHERE is_active " if active_only else ""
    async with request.app.state.db_pool.acquire() as conn:
        rows = await conn.fetch(f"SELECT {PROGRAM_COLS} FROM programs {where}ORDER BY program_name;")
    return [dict(row) for row in rows]


@router.get("/api/programs/{program_id}/eligibility")
async def get_eligibility(program_id: UUID, request: Request):
    async with request.app.state.db_pool.acquire() as conn:
        rows = await conn.fetch(f"SELECT {CRITERIA_COLS} FROM eligibility_criteria WHERE program_id = $1 ORDER BY weight DESC;", program_id)
    return [dict(row) for row in rows]


@router.get("/api/programs/{program_id}/documents")
async def get_documents(program_id: UUID, request: Request):
    async with request.app.state.db_pool.acquire() as conn:
        rows = await conn.fetch(f"SELECT {DOC_COLS} FROM document_requirements WHERE program_id = $1 ORDER BY is_mandatory DESC, document_name;", program_id)
    return [dict(row) for row in rows]


@router.get("/api/meta/attributes")
async def list_attributes():
    """Household attributes a rule can check, for the admin rule form."""
    return [
        {"attribute": a, "label": ATTRIBUTE_LABELS.get(a, a), "computed": a in COMPUTED_ATTRIBUTES}
        for a in list(dict.fromkeys(COMPUTED_ATTRIBUTES + list(ATTRIBUTE_LABELS)))
    ]


# ---------------------------------------------------------------------------
# Programs
# ---------------------------------------------------------------------------
@router.post("/api/programs", status_code=201)
async def create_program(program: ProgramCreate, request: Request, current_admin: dict = Depends(welfare)):
    async with request.app.state.db_pool.acquire() as conn:
        async with conn.transaction():
            row = await conn.fetchrow(
                f"INSERT INTO programs (program_name, agency, scope, is_active) VALUES ($1, $2, $3, $4) RETURNING {PROGRAM_COLS};",
                program.program_name.strip(), program.agency.strip(), program.scope, program.is_active,
            )
            await write_audit(conn, current_admin["sub"], "INSERT", "programs", None, f"{row['program_name']} ({row['agency']}, {row['scope']})")
    return dict(row)


@router.patch("/api/programs/{program_id}")
async def update_program(program_id: UUID, body: ProgramUpdate, request: Request, current_admin: dict = Depends(welfare)):
    changes = body.model_dump(exclude_unset=True)
    if not changes:
        raise HTTPException(status_code=422, detail="Nothing to update")
    async with request.app.state.db_pool.acquire() as conn:
        async with conn.transaction():
            before = await conn.fetchrow(f"SELECT {PROGRAM_COLS} FROM programs WHERE program_id = $1 FOR UPDATE;", program_id)
            if before is None:
                raise HTTPException(status_code=404, detail="Program not found")
            sets = ", ".join(f"{k} = ${i + 2}" for i, k in enumerate(changes))
            row = await conn.fetchrow(f"UPDATE programs SET {sets} WHERE program_id = $1 RETURNING {PROGRAM_COLS};", program_id, *changes.values())
            await write_audit(conn, current_admin["sub"], "UPDATE", "programs",
                              {k: before[k] for k in changes} | {"program": before["program_name"]}, changes)
    return dict(row)


# ---------------------------------------------------------------------------
# Eligibility criteria
# ---------------------------------------------------------------------------
@router.post("/api/programs/{program_id}/eligibility", status_code=201)
async def create_eligibility_criteria(program_id: UUID, criteria: EligibilityCriteriaCreate, request: Request, current_admin: dict = Depends(welfare)):
    async with request.app.state.db_pool.acquire() as conn:
        async with conn.transaction():
            name = await conn.fetchval("SELECT program_name FROM programs WHERE program_id = $1;", program_id)
            if name is None:
                raise HTTPException(status_code=404, detail="Program not found")
            row = await conn.fetchrow(
                f"INSERT INTO eligibility_criteria (program_id, attribute, operator, threshold_value, weight) VALUES ($1, $2, $3, $4, $5) RETURNING {CRITERIA_COLS};",
                program_id, criteria.attribute.strip(), criteria.operator, criteria.threshold_value.strip(), criteria.weight,
            )
            await write_audit(conn, current_admin["sub"], "INSERT", "eligibility_criteria", None, f"{name}: {_rule_text(row)}")
    return dict(row)


@router.patch("/api/programs/{program_id}/eligibility/{criteria_id}")
async def update_eligibility_criteria(program_id: UUID, criteria_id: UUID, criteria: EligibilityCriteriaCreate, request: Request, current_admin: dict = Depends(welfare)):
    async with request.app.state.db_pool.acquire() as conn:
        async with conn.transaction():
            before = await conn.fetchrow(f"SELECT {CRITERIA_COLS} FROM eligibility_criteria WHERE criteria_id = $1 AND program_id = $2;", criteria_id, program_id)
            if before is None:
                raise HTTPException(status_code=404, detail="Rule not found")
            row = await conn.fetchrow(
                f"UPDATE eligibility_criteria SET attribute = $2, operator = $3, threshold_value = $4, weight = $5 WHERE criteria_id = $1 RETURNING {CRITERIA_COLS};",
                criteria_id, criteria.attribute.strip(), criteria.operator, criteria.threshold_value.strip(), criteria.weight,
            )
            await write_audit(conn, current_admin["sub"], "UPDATE", "eligibility_criteria", _rule_text(before), _rule_text(row))
    return dict(row)


@router.delete("/api/programs/{program_id}/eligibility/{criteria_id}", status_code=204)
async def delete_eligibility_criteria(program_id: UUID, criteria_id: UUID, request: Request, current_admin: dict = Depends(welfare)):
    async with request.app.state.db_pool.acquire() as conn:
        async with conn.transaction():
            before = await conn.fetchrow(
                f"DELETE FROM eligibility_criteria WHERE criteria_id = $1 AND program_id = $2 RETURNING {CRITERIA_COLS};", criteria_id, program_id
            )
            if before is None:
                raise HTTPException(status_code=404, detail="Rule not found")
            await write_audit(conn, current_admin["sub"], "DELETE", "eligibility_criteria", _rule_text(before), None)


# ---------------------------------------------------------------------------
# Document requirements
# ---------------------------------------------------------------------------
@router.post("/api/programs/{program_id}/documents", status_code=201)
async def create_document_requirement(program_id: UUID, document: DocumentRequirementCreate, request: Request, current_admin: dict = Depends(welfare)):
    async with request.app.state.db_pool.acquire() as conn:
        async with conn.transaction():
            name = await conn.fetchval("SELECT program_name FROM programs WHERE program_id = $1;", program_id)
            if name is None:
                raise HTTPException(status_code=404, detail="Program not found")
            row = await conn.fetchrow(
                f"INSERT INTO document_requirements (program_id, document_name, is_mandatory, notes) VALUES ($1, $2, $3, $4) RETURNING {DOC_COLS};",
                program_id, document.document_name.strip(), document.is_mandatory, (document.notes or "").strip() or None,
            )
            await write_audit(conn, current_admin["sub"], "INSERT", "document_requirements", None, f"{name}: {row['document_name']}")
    return dict(row)


@router.patch("/api/programs/{program_id}/documents/{doc_id}")
async def update_document_requirement(program_id: UUID, doc_id: UUID, document: DocumentRequirementCreate, request: Request, current_admin: dict = Depends(welfare)):
    async with request.app.state.db_pool.acquire() as conn:
        async with conn.transaction():
            before = await conn.fetchrow(f"SELECT {DOC_COLS} FROM document_requirements WHERE doc_id = $1 AND program_id = $2;", doc_id, program_id)
            if before is None:
                raise HTTPException(status_code=404, detail="Document not found")
            row = await conn.fetchrow(
                f"UPDATE document_requirements SET document_name = $2, is_mandatory = $3, notes = $4 WHERE doc_id = $1 RETURNING {DOC_COLS};",
                doc_id, document.document_name.strip(), document.is_mandatory, (document.notes or "").strip() or None,
            )
            await write_audit(conn, current_admin["sub"], "UPDATE", "document_requirements",
                              f"{before['document_name']} (required={before['is_mandatory']})", f"{row['document_name']} (required={row['is_mandatory']})")
    return dict(row)


@router.delete("/api/programs/{program_id}/documents/{doc_id}", status_code=204)
async def delete_document_requirement(program_id: UUID, doc_id: UUID, request: Request, current_admin: dict = Depends(welfare)):
    async with request.app.state.db_pool.acquire() as conn:
        async with conn.transaction():
            before = await conn.fetchrow(f"DELETE FROM document_requirements WHERE doc_id = $1 AND program_id = $2 RETURNING {DOC_COLS};", doc_id, program_id)
            if before is None:
                raise HTTPException(status_code=404, detail="Document not found")
            await write_audit(conn, current_admin["sub"], "DELETE", "document_requirements", before["document_name"], None)
