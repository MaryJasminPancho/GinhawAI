from fastapi import APIRouter, Request, Depends, HTTPException

from app.schemas import LguOfficeCreate
from app.auth import get_current_admin

router = APIRouter()

@router.get("/api/barangays")
async def list_barangays(request: Request):
    async with request.app.state.db_pool.acquire() as conn:
        rows = await conn.fetch("SELECT barangay_code, barangay_name, city_municipality FROM barangays;")
    return [dict(row) for row in rows]

@router.get("/api/lgu-offices")
async def list_lgu_offices(request: Request):
    async with request.app.state.db_pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT office_id, office_name, address, barangay_code, contact_number, operating_hours FROM lgu_offices;"
        )
    return [dict(row) for row in rows]

@router.post("/api/lgu-offices", status_code=201)
async def create_lgu_office(office: LguOfficeCreate, request: Request, current_admin: dict = Depends(get_current_admin)):
    if current_admin["role"] != "System Administrator":
        raise HTTPException(status_code=403, detail="Only System Administrators can add LGU offices")
    async with request.app.state.db_pool.acquire() as conn:
        row = await conn.fetchrow(
            "INSERT INTO lgu_offices (office_name, address, barangay_code, contact_number, operating_hours) VALUES ($1, $2, $3, $4, $5) "
            "RETURNING office_id, office_name, address, barangay_code, contact_number, operating_hours;",
            office.office_name, office.address, office.barangay_code, office.contact_number, office.operating_hours,
        )
    return dict(row)