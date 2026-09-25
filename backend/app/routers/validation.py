"""Blind Cross-Validation (Fig. 9: "Conduct Blind Cross-Validation Testing").

Social workers rate synthetic household profiles as low / moderate / high
without seeing the scoring engine's answer. The engine's tiers are only
released to a rater after they have rated every case (System Administrators,
who coordinate the test, can see results at any time).
"""

import random

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from app.audit import write_audit
from app.auth import SYSTEM_ADMIN, WELFARE_ROLES, require_roles
from app.schemas import RatingIn
from app.scoring import CRISIS_VALUES, EMPLOYMENT_VALUES, HOUSING_VALUES, derive_profile, score_vulnerability

router = APIRouter()
welfare = require_roles(WELFARE_ROLES)


class GenerateIn(BaseModel):
    count: int = Field(ge=1, le=100)


def synthetic_profile(rng: random.Random, barangays: list[str]) -> dict:
    size = rng.randint(1, 9)
    return {
        "barangay": rng.choice(barangays) if barangays else "—",
        "household_size": size,
        "monthly_income": rng.randrange(2000, 35000, 500),
        "employment_status": rng.choice(EMPLOYMENT_VALUES),
        "age": rng.randint(18, 75),
        "housing_type": rng.choice(HOUSING_VALUES),
        "has_children_0_18": rng.random() < 0.6 if size > 1 else False,
        "has_pwd": rng.random() < 0.15,
        "is_solo_parent": rng.random() < 0.15 if size > 1 else False,
        "crisis_type": rng.choice(CRISIS_VALUES[1:]) if rng.random() < 0.25 else "none",
    }


async def _is_done(conn, user_id: str) -> bool:
    total = await conn.fetchval("SELECT COUNT(*) FROM validation_cases;")
    mine = await conn.fetchval("SELECT COUNT(*) FROM validation_ratings WHERE user_id = $1::uuid;", user_id)
    return total > 0 and mine >= total


@router.get("/api/validation/cases")
async def list_cases(request: Request, current_admin: dict = Depends(welfare)):
    async with request.app.state.db_pool.acquire() as conn:
        rows = await conn.fetch("SELECT case_id, profile FROM validation_cases ORDER BY case_id;")
    return [{"case_id": r["case_id"], **r["profile"]} for r in rows]


@router.post("/api/validation/cases/generate", status_code=201)
async def generate_cases(body: GenerateIn, request: Request, current_admin: dict = Depends(welfare)):
    rng = random.Random()
    async with request.app.state.db_pool.acquire() as conn:
        async with conn.transaction():
            barangays = [r["barangay_name"] for r in await conn.fetch("SELECT barangay_name FROM barangays;")]
            start = await conn.fetchval("SELECT COALESCE(MAX(CAST(SUBSTRING(case_id FROM 4) AS INTEGER)), 0) FROM validation_cases WHERE case_id ~ '^SP-[0-9]+$';")
            for i in range(body.count):
                await conn.execute(
                    "INSERT INTO validation_cases (case_id, profile) VALUES ($1, $2);",
                    f"SP-{start + i + 1:03d}", synthetic_profile(rng, barangays),
                )
            await write_audit(conn, current_admin["sub"], "INSERT", "validation_cases", None, f"Generated {body.count} synthetic profiles")
    return {"created": body.count}


@router.delete("/api/validation/cases", status_code=204)
async def reset_cases(request: Request, current_admin: dict = Depends(require_roles({SYSTEM_ADMIN}))):
    async with request.app.state.db_pool.acquire() as conn:
        async with conn.transaction():
            n = await conn.fetchval("SELECT COUNT(*) FROM validation_cases;")
            await conn.execute("DELETE FROM validation_cases;")
            await write_audit(conn, current_admin["sub"], "DELETE", "validation_cases", f"{n} cases and their ratings", None)


@router.get("/api/validation/ratings")
async def list_ratings(request: Request, current_admin: dict = Depends(welfare)):
    async with request.app.state.db_pool.acquire() as conn:
        done = await _is_done(conn, current_admin["sub"])
        if done or current_admin["role"] == SYSTEM_ADMIN:
            rows = await conn.fetch(
                "SELECT r.case_id, au.username AS rater, r.tier FROM validation_ratings r JOIN admin_users au ON au.user_id = r.user_id;"
            )
        else:
            # Before finishing, a rater only sees their own ratings.
            rows = await conn.fetch(
                "SELECT r.case_id, au.username AS rater, r.tier FROM validation_ratings r JOIN admin_users au ON au.user_id = r.user_id WHERE r.user_id = $1::uuid;",
                current_admin["sub"],
            )
    return [dict(r) for r in rows]


@router.put("/api/validation/cases/{case_id}/rating")
async def rate_case(case_id: str, body: RatingIn, request: Request, current_admin: dict = Depends(welfare)):
    async with request.app.state.db_pool.acquire() as conn:
        exists = await conn.fetchval("SELECT 1 FROM validation_cases WHERE case_id = $1;", case_id)
        if not exists:
            raise HTTPException(status_code=404, detail="Case not found")
        await conn.execute(
            "INSERT INTO validation_ratings (case_id, user_id, tier) VALUES ($1, $2::uuid, $3) "
            "ON CONFLICT (case_id, user_id) DO UPDATE SET tier = EXCLUDED.tier, rated_at = NOW();",
            case_id, current_admin["sub"], body.tier,
        )
    return {"ok": True}


@router.get("/api/validation/model-results")
async def model_results(request: Request, current_admin: dict = Depends(welfare)):
    async with request.app.state.db_pool.acquire() as conn:
        if current_admin["role"] != SYSTEM_ADMIN and not await _is_done(conn, current_admin["sub"]):
            raise HTTPException(status_code=403, detail="Finish rating every case first — results stay hidden to keep the test blind.")
        rows = await conn.fetch("SELECT case_id, profile FROM validation_cases;")
    return {r["case_id"]: score_vulnerability(derive_profile(r["profile"]))["tier"] for r in rows}
