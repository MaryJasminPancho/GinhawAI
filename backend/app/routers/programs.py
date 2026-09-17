from uuid import UUID
from fastapi import APIRouter, Request, Depends, HTTPException

from app.schemas import ProgramCreate, EligibilityCriteriaCreate, DocumentRequirementCreate
from app.auth import get_current_admin

router = APIRouter()

def _require_admin(current_admin: dict):
    if current_admin["role"] != "System Administrator":
        raise HTTPException(status_code=403, detail="Only System Administrators can do this")

@router.get("/api/programs")
async def list_programs(request: Request):
    async with request.app.state.db_pool.acquire() as conn:
        rows = await conn.fetch("SELECT program_id, program_name, agency, scope, is_active FROM programs;")
    return [dict(row) for row in rows]

@router.get("/api/programs/{program_id}/eligibility")
async def get_eligibility(program_id: UUID, request: Request):
    async with request.app.state.db_pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT criteria_id, attribute, operator, threshold_value, weight FROM eligibility_criteria WHERE program_id = $1;",
            program_id,
        )
    return [dict(row) for row in rows]

@router.get("/api/programs/{program_id}/documents")
async def get_documents(program_id: UUID, request: Request):
    async with request.app.state.db_pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT doc_id, document_name, is_mandatory, notes FROM document_requirements WHERE program_id = $1;",
            program_id,
        )
    return [dict(row) for row in rows]

@router.post("/api/programs", status_code=201)
async def create_program(program: ProgramCreate, request: Request, current_admin: dict = Depends(get_current_admin)):
    _require_admin(current_admin)
    async with request.app.state.db_pool.acquire() as conn:
        row = await conn.fetchrow(
            "INSERT INTO programs (program_name, agency, scope, is_active) VALUES ($1, $2, $3, $4) "
            "RETURNING program_id, program_name, agency, scope, is_active;",
            program.program_name, program.agency, program.scope, program.is_active,
        )
    return dict(row)

@router.post("/api/programs/{program_id}/eligibility", status_code=201)
async def create_eligibility_criteria(program_id: UUID, criteria: EligibilityCriteriaCreate, request: Request, current_admin: dict = Depends(get_current_admin)):
    _require_admin(current_admin)
    async with request.app.state.db_pool.acquire() as conn:
        row = await conn.fetchrow(
            "INSERT INTO eligibility_criteria (program_id, attribute, operator, threshold_value, weight) VALUES ($1, $2, $3, $4, $5) "
            "RETURNING criteria_id, program_id, attribute, operator, threshold_value, weight;",
            program_id, criteria.attribute, criteria.operator, criteria.threshold_value, criteria.weight,
        )
    return dict(row)

@router.post("/api/programs/{program_id}/documents", status_code=201)
async def create_document_requirement(program_id: UUID, document: DocumentRequirementCreate, request: Request, current_admin: dict = Depends(get_current_admin)):
    _require_admin(current_admin)
    async with request.app.state.db_pool.acquire() as conn:
        row = await conn.fetchrow(
            "INSERT INTO document_requirements (program_id, document_name, is_mandatory, notes) VALUES ($1, $2, $3, $4) "
            "RETURNING doc_id, program_id, document_name, is_mandatory, notes;",
            program_id, document.document_name, document.is_mandatory, document.notes,
        )
    return dict(row)