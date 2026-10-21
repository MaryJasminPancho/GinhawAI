"""Partner registry: NGOs and civil society groups and the help they offer.

Appendix R #40 "Maintain Local Civil Society Registries" (organizations) and
#38 "Track Neighborhood NGO Resource Tracks" (what each one offers, where and
when).

Who can do what:
* LGU Administrator, Social Worker, System Administrator: manage every entry and
  verify entries from partners.
* Partner Organization: manages only the organizations it added. Anything it
  adds or changes is hidden from citizens until LGU staff verify it again.
* LGU Executive: can view the registry, not change it.
Citizens see verified, active organizations and their current resources.
"""

from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field, model_validator

from app.audit import write_audit
from app.auth import LGU_EXECUTIVE, PARTNER_ORG, WELFARE_ROLES, get_current_admin

router = APIRouter()

ORG_TYPES = {
    "ngo": "NGO", "faith_based": "Faith-based group", "civic": "Civic / community group", "cooperative": "Cooperative",
    "private": "Private company / foundation", "academe": "School / university", "government": "Government partner",
}
ORG_COLS = ("o.org_id, o.name, o.org_type, o.services, o.address, o.barangay_code, b.barangay_name, o.contact, "
            "o.is_verified, o.is_active, o.managed_by, o.created_at, o.updated_at")
RES_COLS = "resource_id, org_id, title, details, barangay_code, starts_on, ends_on"


class OrgIn(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    org_type: str = Field(pattern=r"^(ngo|faith_based|civic|cooperative|private|academe|government)$")
    services: str | None = Field(default=None, max_length=2000)
    address: str | None = Field(default=None, max_length=500)
    barangay_code: str | None = Field(default=None, max_length=20)
    contact: str | None = Field(default=None, max_length=100)
    is_active: bool = True


class ResourceIn(BaseModel):
    title: str = Field(min_length=2, max_length=200)
    details: str | None = Field(default=None, max_length=2000)
    barangay_code: str | None = Field(default=None, max_length=20)
    starts_on: date | None = None
    ends_on: date | None = None

    @model_validator(mode="after")
    def dates_in_order(self):
        if self.starts_on and self.ends_on and self.ends_on < self.starts_on:
            raise ValueError("The end date can't be before the start date.")
        return self


class VerifyIn(BaseModel):
    is_verified: bool


def _clean(v: str | None) -> str | None:
    return (v or "").strip() or None


def _is_staff(admin: dict) -> bool:
    return admin["role"] in WELFARE_ROLES


def _can_view(admin: dict) -> bool:
    return _is_staff(admin) or admin["role"] in (LGU_EXECUTIVE, PARTNER_ORG)


def _can_edit(admin: dict, org) -> bool:
    return _is_staff(admin) or (admin["role"] == PARTNER_ORG and org["managed_by"] is not None and str(org["managed_by"]) == admin["sub"])


async def _org(conn, org_id: UUID):
    row = await conn.fetchrow(
        f"SELECT {ORG_COLS} FROM partner_organizations o LEFT JOIN barangays b ON b.barangay_code = o.barangay_code WHERE o.org_id = $1;", org_id
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Organization not found")
    return row


async def _check_barangay(conn, code: str | None):
    if code and not await conn.fetchval("SELECT 1 FROM barangays WHERE barangay_code = $1;", code):
        raise HTTPException(status_code=422, detail="Unknown barangay.")


def _org_view(row, resources, admin: dict) -> dict:
    d = dict(row)
    d["org_type_label"] = ORG_TYPES.get(d["org_type"], d["org_type"])
    d["managed_by"] = str(d["managed_by"]) if d["managed_by"] else None
    d["can_edit"] = _can_edit(admin, row)
    d["resources"] = [dict(r) for r in resources if r["org_id"] == row["org_id"]]
    return d


# ---------------------------------------------------------------------------
# Public: what citizens see
# ---------------------------------------------------------------------------
async def public_partners(conn) -> list[dict]:
    """Verified, active organizations with their current (not yet ended) resources."""
    orgs = await conn.fetch(
        f"SELECT {ORG_COLS} FROM partner_organizations o LEFT JOIN barangays b ON b.barangay_code = o.barangay_code "
        "WHERE o.is_verified AND o.is_active ORDER BY o.name;"
    )
    res = await conn.fetch(
        "SELECT r.resource_id, r.org_id, r.title, r.details, r.starts_on, r.ends_on, b.barangay_name "
        "FROM partner_resources r LEFT JOIN barangays b ON b.barangay_code = r.barangay_code "
        "WHERE r.ends_on IS NULL OR r.ends_on >= CURRENT_DATE ORDER BY r.starts_on NULLS FIRST, r.title;"
    )
    return [
        {
            "name": o["name"], "org_type": ORG_TYPES.get(o["org_type"], o["org_type"]), "services": o["services"],
            "address": o["address"], "barangay_name": o["barangay_name"], "contact": o["contact"],
            "resources": [
                {"title": r["title"], "details": r["details"], "barangay_name": r["barangay_name"],
                 "starts_on": r["starts_on"].isoformat() if r["starts_on"] else None,
                 "ends_on": r["ends_on"].isoformat() if r["ends_on"] else None}
                for r in res if r["org_id"] == o["org_id"]
            ],
        }
        for o in orgs
    ]


@router.get("/api/partners")
async def list_public_partners(request: Request):
    async with request.app.state.db_pool.acquire() as conn:
        return await public_partners(conn)


# ---------------------------------------------------------------------------
# Admin console: Partner Registry
# ---------------------------------------------------------------------------
@router.get("/api/admin/partners")
async def list_partners(request: Request, current_admin: dict = Depends(get_current_admin)):
    if not _can_view(current_admin):
        raise HTTPException(status_code=403, detail="Your role can't view the partner registry")
    own_only = current_admin["role"] == PARTNER_ORG
    async with request.app.state.db_pool.acquire() as conn:
        orgs = await conn.fetch(
            f"SELECT {ORG_COLS} FROM partner_organizations o LEFT JOIN barangays b ON b.barangay_code = o.barangay_code "
            "WHERE NOT $1::boolean OR o.managed_by = $2::uuid ORDER BY o.is_verified, o.name;",
            own_only, current_admin["sub"],
        )
        resources = await conn.fetch(f"SELECT {RES_COLS} FROM partner_resources ORDER BY starts_on NULLS FIRST, title;")
    return {
        "org_types": [{"value": k, "label": v} for k, v in ORG_TYPES.items()],
        "can_create": _is_staff(current_admin) or current_admin["role"] == PARTNER_ORG,
        "can_verify": _is_staff(current_admin),
        "organizations": [_org_view(o, resources, current_admin) for o in orgs],
    }


@router.post("/api/admin/partners", status_code=201)
async def create_partner(body: OrgIn, request: Request, current_admin: dict = Depends(get_current_admin)):
    if not (_is_staff(current_admin) or current_admin["role"] == PARTNER_ORG):
        raise HTTPException(status_code=403, detail="Your role can't add organizations")
    staff = _is_staff(current_admin)
    async with request.app.state.db_pool.acquire() as conn:
        async with conn.transaction():
            await _check_barangay(conn, _clean(body.barangay_code))
            org_id = await conn.fetchval(
                "INSERT INTO partner_organizations (name, org_type, services, address, barangay_code, contact, is_active, is_verified, managed_by) "
                "VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::uuid) RETURNING org_id;",
                body.name.strip(), body.org_type, _clean(body.services), _clean(body.address), _clean(body.barangay_code),
                _clean(body.contact), body.is_active, staff, None if staff else current_admin["sub"],
            )
            await write_audit(conn, current_admin["sub"], "INSERT", "partner_organizations", None,
                              f"{body.name.strip()} ({ORG_TYPES[body.org_type]})" + ("" if staff else " — awaiting verification"))
            row = await _org(conn, org_id)
    return _org_view(row, [], current_admin)


@router.patch("/api/admin/partners/{org_id}")
async def update_partner(org_id: UUID, body: OrgIn, request: Request, current_admin: dict = Depends(get_current_admin)):
    async with request.app.state.db_pool.acquire() as conn:
        async with conn.transaction():
            before = await _org(conn, org_id)
            if not _can_edit(current_admin, before):
                raise HTTPException(status_code=403, detail="You can only change your own organization")
            await _check_barangay(conn, _clean(body.barangay_code))
            # A partner's own edits need LGU staff to look again before citizens see them.
            verified = before["is_verified"] if _is_staff(current_admin) else False
            await conn.execute(
                "UPDATE partner_organizations SET name = $2, org_type = $3, services = $4, address = $5, barangay_code = $6, "
                "contact = $7, is_active = $8, is_verified = $9, updated_at = NOW() WHERE org_id = $1;",
                org_id, body.name.strip(), body.org_type, _clean(body.services), _clean(body.address),
                _clean(body.barangay_code), _clean(body.contact), body.is_active, verified,
            )
            await write_audit(conn, current_admin["sub"], "UPDATE", "partner_organizations", before["name"],
                              body.name.strip() + ("" if verified or not before["is_verified"] else " — awaiting re-verification"))
            row = await _org(conn, org_id)
            res = await conn.fetch(f"SELECT {RES_COLS} FROM partner_resources WHERE org_id = $1;", org_id)
    return _org_view(row, res, current_admin)


@router.post("/api/admin/partners/{org_id}/verify")
async def verify_partner(org_id: UUID, body: VerifyIn, request: Request, current_admin: dict = Depends(get_current_admin)):
    if not _is_staff(current_admin):
        raise HTTPException(status_code=403, detail="Only LGU staff can verify organizations")
    async with request.app.state.db_pool.acquire() as conn:
        async with conn.transaction():
            before = await _org(conn, org_id)
            await conn.execute("UPDATE partner_organizations SET is_verified = $2, updated_at = NOW() WHERE org_id = $1;", org_id, body.is_verified)
            await write_audit(conn, current_admin["sub"], "UPDATE", "partner_organizations", before["name"],
                              f"{before['name']}: {'verified' if body.is_verified else 'verification removed'}")
            row = await _org(conn, org_id)
            res = await conn.fetch(f"SELECT {RES_COLS} FROM partner_resources WHERE org_id = $1;", org_id)
    return _org_view(row, res, current_admin)


@router.delete("/api/admin/partners/{org_id}", status_code=204)
async def delete_partner(org_id: UUID, request: Request, current_admin: dict = Depends(get_current_admin)):
    async with request.app.state.db_pool.acquire() as conn:
        async with conn.transaction():
            before = await _org(conn, org_id)
            if not _can_edit(current_admin, before):
                raise HTTPException(status_code=403, detail="You can only remove your own organization")
            await conn.execute("DELETE FROM partner_organizations WHERE org_id = $1;", org_id)
            await write_audit(conn, current_admin["sub"], "DELETE", "partner_organizations", before["name"], None)


# ---- resources (what an organization offers) ------------------------------
async def _org_for_resource_edit(conn, org_id: UUID, admin: dict):
    org = await _org(conn, org_id)
    if not _can_edit(admin, org):
        raise HTTPException(status_code=403, detail="You can only change your own organization's resources")
    return org


async def _mark_unverified_if_partner(conn, org, admin: dict):
    if not _is_staff(admin) and org["is_verified"]:
        await conn.execute("UPDATE partner_organizations SET is_verified = FALSE, updated_at = NOW() WHERE org_id = $1;", org["org_id"])


@router.post("/api/admin/partners/{org_id}/resources", status_code=201)
async def add_resource(org_id: UUID, body: ResourceIn, request: Request, current_admin: dict = Depends(get_current_admin)):
    async with request.app.state.db_pool.acquire() as conn:
        async with conn.transaction():
            org = await _org_for_resource_edit(conn, org_id, current_admin)
            await _check_barangay(conn, _clean(body.barangay_code))
            row = await conn.fetchrow(
                f"INSERT INTO partner_resources (org_id, title, details, barangay_code, starts_on, ends_on) VALUES ($1, $2, $3, $4, $5, $6) RETURNING {RES_COLS};",
                org_id, body.title.strip(), _clean(body.details), _clean(body.barangay_code), body.starts_on, body.ends_on,
            )
            await _mark_unverified_if_partner(conn, org, current_admin)
            await write_audit(conn, current_admin["sub"], "INSERT", "partner_resources", None, f"{org['name']}: {body.title.strip()}")
    return dict(row)


@router.patch("/api/admin/partner-resources/{resource_id}")
async def update_resource(resource_id: UUID, body: ResourceIn, request: Request, current_admin: dict = Depends(get_current_admin)):
    async with request.app.state.db_pool.acquire() as conn:
        async with conn.transaction():
            before = await conn.fetchrow(f"SELECT {RES_COLS} FROM partner_resources WHERE resource_id = $1;", resource_id)
            if before is None:
                raise HTTPException(status_code=404, detail="Resource not found")
            org = await _org_for_resource_edit(conn, before["org_id"], current_admin)
            await _check_barangay(conn, _clean(body.barangay_code))
            row = await conn.fetchrow(
                f"UPDATE partner_resources SET title = $2, details = $3, barangay_code = $4, starts_on = $5, ends_on = $6 WHERE resource_id = $1 RETURNING {RES_COLS};",
                resource_id, body.title.strip(), _clean(body.details), _clean(body.barangay_code), body.starts_on, body.ends_on,
            )
            await _mark_unverified_if_partner(conn, org, current_admin)
            await write_audit(conn, current_admin["sub"], "UPDATE", "partner_resources", f"{org['name']}: {before['title']}", f"{org['name']}: {body.title.strip()}")
    return dict(row)


@router.delete("/api/admin/partner-resources/{resource_id}", status_code=204)
async def delete_resource(resource_id: UUID, request: Request, current_admin: dict = Depends(get_current_admin)):
    async with request.app.state.db_pool.acquire() as conn:
        async with conn.transaction():
            before = await conn.fetchrow(f"SELECT {RES_COLS} FROM partner_resources WHERE resource_id = $1;", resource_id)
            if before is None:
                raise HTTPException(status_code=404, detail="Resource not found")
            org = await _org_for_resource_edit(conn, before["org_id"], current_admin)
            await conn.execute("DELETE FROM partner_resources WHERE resource_id = $1;", resource_id)
            await write_audit(conn, current_admin["sub"], "DELETE", "partner_resources", f"{org['name']}: {before['title']}", None)
