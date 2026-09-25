"""Localization Module: barangays, LGU offices and barangay aid schedules.

"Insert Local Barangay Aid Schedules" and "Update Municipal Office Directories"
(Fig. 9) — Authorized Welfare Personnel. Reads of barangays/offices are public.
"""

from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request

from app.audit import write_audit
from app.auth import WELFARE_ROLES, require_roles
from app.schemas import BarangayCreate, LguOfficeCreate, ScheduleCreate

router = APIRouter()
welfare = require_roles(WELFARE_ROLES)

BARANGAY_COLS = "barangay_code, barangay_name, city_municipality, latitude, longitude"
OFFICE_COLS = "office_id, office_name, address, barangay_code, contact_number, operating_hours"
SCHEDULE_COLS = "schedule_id, office_id, program_id, start_date, end_date, notes"


def _clean(v: str | None) -> str | None:
    return (v or "").strip() or None


# ---------------------------------------------------------------------------
# Barangays
# ---------------------------------------------------------------------------
@router.get("/api/barangays")
async def list_barangays(request: Request):
    async with request.app.state.db_pool.acquire() as conn:
        rows = await conn.fetch(f"SELECT {BARANGAY_COLS} FROM barangays ORDER BY barangay_name;")
    return [dict(row) for row in rows]


@router.post("/api/barangays", status_code=201)
async def create_barangay(body: BarangayCreate, request: Request, current_admin: dict = Depends(welfare)):
    async with request.app.state.db_pool.acquire() as conn:
        try:
            async with conn.transaction():
                row = await conn.fetchrow(
                    f"INSERT INTO barangays ({BARANGAY_COLS}) VALUES ($1, $2, $3, $4, $5) RETURNING {BARANGAY_COLS};",
                    body.barangay_code.strip(), body.barangay_name.strip(), body.city_municipality.strip(), body.latitude, body.longitude,
                )
                await write_audit(conn, current_admin["sub"], "INSERT", "barangays", None, f"{row['barangay_name']} ({row['barangay_code']})")
        except asyncpg.UniqueViolationError:
            raise HTTPException(status_code=409, detail="A barangay with that code already exists")
    return dict(row)


@router.patch("/api/barangays/{code}")
async def update_barangay(code: str, body: BarangayCreate, request: Request, current_admin: dict = Depends(welfare)):
    if body.barangay_code != code:
        raise HTTPException(status_code=422, detail="The barangay code can't be changed")
    async with request.app.state.db_pool.acquire() as conn:
        async with conn.transaction():
            before = await conn.fetchrow(f"SELECT {BARANGAY_COLS} FROM barangays WHERE barangay_code = $1;", code)
            if before is None:
                raise HTTPException(status_code=404, detail="Barangay not found")
            row = await conn.fetchrow(
                f"UPDATE barangays SET barangay_name = $2, city_municipality = $3, latitude = $4, longitude = $5 WHERE barangay_code = $1 RETURNING {BARANGAY_COLS};",
                code, body.barangay_name.strip(), body.city_municipality.strip(), body.latitude, body.longitude,
            )
            await write_audit(conn, current_admin["sub"], "UPDATE", "barangays", dict(before), dict(row))
    return dict(row)


# ---------------------------------------------------------------------------
# LGU offices
# ---------------------------------------------------------------------------
@router.get("/api/lgu-offices")
async def list_lgu_offices(request: Request):
    async with request.app.state.db_pool.acquire() as conn:
        rows = await conn.fetch(f"SELECT {OFFICE_COLS} FROM lgu_offices ORDER BY office_name;")
    return [dict(row) for row in rows]


@router.post("/api/lgu-offices", status_code=201)
async def create_lgu_office(office: LguOfficeCreate, request: Request, current_admin: dict = Depends(welfare)):
    async with request.app.state.db_pool.acquire() as conn:
        try:
            async with conn.transaction():
                row = await conn.fetchrow(
                    f"INSERT INTO lgu_offices (office_name, address, barangay_code, contact_number, operating_hours) VALUES ($1, $2, $3, $4, $5) RETURNING {OFFICE_COLS};",
                    office.office_name.strip(), _clean(office.address), _clean(office.barangay_code), _clean(office.contact_number), _clean(office.operating_hours),
                )
                await write_audit(conn, current_admin["sub"], "INSERT", "lgu_offices", None, row["office_name"])
        except asyncpg.ForeignKeyViolationError:
            raise HTTPException(status_code=422, detail="That barangay doesn't exist")
    return dict(row)


@router.patch("/api/lgu-offices/{office_id}")
async def update_lgu_office(office_id: UUID, office: LguOfficeCreate, request: Request, current_admin: dict = Depends(welfare)):
    async with request.app.state.db_pool.acquire() as conn:
        try:
            async with conn.transaction():
                before = await conn.fetchrow(f"SELECT {OFFICE_COLS} FROM lgu_offices WHERE office_id = $1;", office_id)
                if before is None:
                    raise HTTPException(status_code=404, detail="Office not found")
                row = await conn.fetchrow(
                    "UPDATE lgu_offices SET office_name = $2, address = $3, barangay_code = $4, contact_number = $5, operating_hours = $6 "
                    f"WHERE office_id = $1 RETURNING {OFFICE_COLS};",
                    office_id, office.office_name.strip(), _clean(office.address), _clean(office.barangay_code), _clean(office.contact_number), _clean(office.operating_hours),
                )
                changed = {k: row[k] for k in row.keys() if row[k] != before[k]}
                await write_audit(conn, current_admin["sub"], "UPDATE", "lgu_offices",
                                  {k: before[k] for k in changed} | {"office": before["office_name"]}, changed)
        except asyncpg.ForeignKeyViolationError:
            raise HTTPException(status_code=422, detail="That barangay doesn't exist")
    return dict(row)


@router.delete("/api/lgu-offices/{office_id}", status_code=204)
async def delete_lgu_office(office_id: UUID, request: Request, current_admin: dict = Depends(welfare)):
    async with request.app.state.db_pool.acquire() as conn:
        try:
            async with conn.transaction():
                name = await conn.fetchval("DELETE FROM lgu_offices WHERE office_id = $1 RETURNING office_name;", office_id)
                if name is None:
                    raise HTTPException(status_code=404, detail="Office not found")
                await write_audit(conn, current_admin["sub"], "DELETE", "lgu_offices", name, None)
        except asyncpg.ForeignKeyViolationError:
            raise HTTPException(status_code=409, detail="Staff accounts still belong to this office. Move them to another office first.")


# ---------------------------------------------------------------------------
# Barangay aid schedules (Table 15)
# ---------------------------------------------------------------------------
async def _schedule_text(conn, s) -> str:
    names = await conn.fetchrow(
        "SELECT (SELECT program_name FROM programs WHERE program_id = $1) AS p, (SELECT office_name FROM lgu_offices WHERE office_id = $2) AS o;",
        s["program_id"], s["office_id"],
    )
    return f"{names['p']} @ {names['o']}: {s['start_date']} to {s['end_date']}"


@router.get("/api/barangay-schedules")
async def list_schedules(request: Request, current_admin: dict = Depends(welfare)):
    async with request.app.state.db_pool.acquire() as conn:
        rows = await conn.fetch(f"SELECT {SCHEDULE_COLS} FROM barangay_schedules ORDER BY start_date;")
    return [dict(r) for r in rows]


@router.post("/api/barangay-schedules", status_code=201)
async def create_schedule(body: ScheduleCreate, request: Request, current_admin: dict = Depends(welfare)):
    if body.end_date < body.start_date:
        raise HTTPException(status_code=422, detail="The end date can't be before the start date")
    async with request.app.state.db_pool.acquire() as conn:
        try:
            async with conn.transaction():
                row = await conn.fetchrow(
                    f"INSERT INTO barangay_schedules (office_id, program_id, start_date, end_date, notes) VALUES ($1::uuid, $2::uuid, $3, $4, $5) RETURNING {SCHEDULE_COLS};",
                    body.office_id, body.program_id, body.start_date, body.end_date, _clean(body.notes),
                )
                await write_audit(conn, current_admin["sub"], "INSERT", "barangay_schedules", None, await _schedule_text(conn, row))
        except (asyncpg.ForeignKeyViolationError, asyncpg.DataError):
            raise HTTPException(status_code=422, detail="Choose a valid program and office")
    return dict(row)


@router.patch("/api/barangay-schedules/{schedule_id}")
async def update_schedule(schedule_id: UUID, body: ScheduleCreate, request: Request, current_admin: dict = Depends(welfare)):
    if body.end_date < body.start_date:
        raise HTTPException(status_code=422, detail="The end date can't be before the start date")
    async with request.app.state.db_pool.acquire() as conn:
        try:
            async with conn.transaction():
                before = await conn.fetchrow(f"SELECT {SCHEDULE_COLS} FROM barangay_schedules WHERE schedule_id = $1;", schedule_id)
                if before is None:
                    raise HTTPException(status_code=404, detail="Schedule not found")
                old_text = await _schedule_text(conn, before)
                row = await conn.fetchrow(
                    "UPDATE barangay_schedules SET office_id = $2::uuid, program_id = $3::uuid, start_date = $4, end_date = $5, notes = $6 "
                    f"WHERE schedule_id = $1 RETURNING {SCHEDULE_COLS};",
                    schedule_id, body.office_id, body.program_id, body.start_date, body.end_date, _clean(body.notes),
                )
                await write_audit(conn, current_admin["sub"], "UPDATE", "barangay_schedules", old_text, await _schedule_text(conn, row))
        except (asyncpg.ForeignKeyViolationError, asyncpg.DataError):
            raise HTTPException(status_code=422, detail="Choose a valid program and office")
    return dict(row)


@router.delete("/api/barangay-schedules/{schedule_id}", status_code=204)
async def delete_schedule(schedule_id: UUID, request: Request, current_admin: dict = Depends(welfare)):
    async with request.app.state.db_pool.acquire() as conn:
        async with conn.transaction():
            before = await conn.fetchrow(f"SELECT {SCHEDULE_COLS} FROM barangay_schedules WHERE schedule_id = $1;", schedule_id)
            if before is None:
                raise HTTPException(status_code=404, detail="Schedule not found")
            old_text = await _schedule_text(conn, before)
            await conn.execute("DELETE FROM barangay_schedules WHERE schedule_id = $1;", schedule_id)
            await write_audit(conn, current_admin["sub"], "DELETE", "barangay_schedules", old_text, None)
