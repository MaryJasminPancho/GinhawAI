"""Optional citizen accounts (2nd consultation, 2026-10-30).

The chat works without an account. Signing up (username + password, or Google) only
lets a citizen keep their own answers and past results, so they can come back, change
an answer and see which programs fit now. Accounts are created only with explicit
consent (RA 10173), and "Delete my account" removes everything.

Citizen tokens carry typ="citizen" and are never accepted by the staff console.
"""

import re
from datetime import datetime, timedelta, timezone

import httpx
import jwt
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel, Field

from app import chatflow
from app.auth import hash_password, verify_password
from app.config import GOOGLE_CLIENT_ID, JWT_ALGORITHM, SECRET_KEY

router = APIRouter()

TOKEN_DAYS = 30
MAX_FAILED = 5
LOCK_MINUTES = 15
USERNAME = re.compile(r"^[A-Za-z0-9._-]{4,40}$")


class SignUp(BaseModel):
    username: str = Field(max_length=40)
    password: str = Field(max_length=200)
    display_name: str | None = Field(default=None, max_length=100)
    consent: bool = False


class LogIn(BaseModel):
    username: str = Field(max_length=40)
    password: str = Field(max_length=200)


class GoogleSignIn(BaseModel):
    credential: str = Field(max_length=4096)
    consent: bool = False


class ProfileIn(BaseModel):
    entities: dict
    language: str | None = None


def create_citizen_token(citizen_id: str) -> str:
    now = datetime.now(timezone.utc)
    return jwt.encode({"sub": citizen_id, "typ": "citizen", "iat": int(now.timestamp()), "exp": now + timedelta(days=TOKEN_DAYS)},
                      SECRET_KEY, algorithm=JWT_ALGORITHM)


def citizen_id_from(authorization: str | None) -> str | None:
    """The signed-in citizen's id from an "Authorization: Bearer …" header, or None (anonymous)."""
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    try:
        claims = jwt.decode(authorization[7:], SECRET_KEY, algorithms=[JWT_ALGORITHM])
    except jwt.InvalidTokenError:
        return None
    return claims["sub"] if claims.get("typ") == "citizen" else None


async def current_citizen(request: Request, authorization: str | None = Header(default=None)) -> dict:
    cid = citizen_id_from(authorization)
    if cid is None:
        raise HTTPException(status_code=401, detail="Please log in again.")
    async with request.app.state.db_pool.acquire() as conn:
        row = await conn.fetchrow("SELECT citizen_id, username, email, display_name, google_sub, created_at FROM citizen_accounts WHERE citizen_id = $1::uuid;", cid)
    if row is None:
        raise HTTPException(status_code=401, detail="Please log in again.")
    return dict(row)


def _session(row) -> dict:
    return {"token": create_citizen_token(str(row["citizen_id"])), "display_name": row["display_name"] or row["username"] or row["email"]}


@router.get("/api/citizen/config")
async def citizen_config():
    """Which sign-in options are available (the Google button shows only when configured)."""
    return {"google_client_id": GOOGLE_CLIENT_ID}


@router.post("/api/citizen/signup", status_code=201)
async def sign_up(body: SignUp, request: Request):
    if not body.consent:
        raise HTTPException(status_code=422, detail="Please agree to let GinhawAI save your answers.")
    if not USERNAME.match(body.username):
        raise HTTPException(status_code=422, detail="Username: 4–40 letters, numbers, dots, dashes or underscores.")
    if len(body.password) < 8:
        raise HTTPException(status_code=422, detail="Password must be at least 8 characters.")
    async with request.app.state.db_pool.acquire() as conn:
        try:
            row = await conn.fetchrow(
                "INSERT INTO citizen_accounts (username, password_hash, display_name, consent_at, last_login_at) "
                "VALUES (lower($1), $2, $3, now(), now()) RETURNING citizen_id, username, email, display_name;",
                body.username, hash_password(body.password), (body.display_name or "").strip() or None,
            )
        except Exception as e:  # unique username
            if "unique" in str(e).lower():
                raise HTTPException(status_code=409, detail="That username is taken. Please choose another.")
            raise
    return _session(row)


@router.post("/api/citizen/login")
async def log_in(body: LogIn, request: Request):
    async with request.app.state.db_pool.acquire() as conn:
        row = await conn.fetchrow("SELECT * FROM citizen_accounts WHERE username = lower($1);", body.username.strip())
        if row and row["locked_until"] and row["locked_until"] > datetime.now(timezone.utc):
            raise HTTPException(status_code=429, detail=f"Too many tries. Please wait {LOCK_MINUTES} minutes and try again.")
        if row is None or not row["password_hash"] or not verify_password(body.password, row["password_hash"]):
            if row is not None:
                await conn.execute(
                    "UPDATE citizen_accounts SET failed_attempts = failed_attempts + 1, "
                    "locked_until = CASE WHEN failed_attempts + 1 >= $2 THEN now() + make_interval(mins => $3) END WHERE citizen_id = $1;",
                    row["citizen_id"], MAX_FAILED, LOCK_MINUTES,
                )
            raise HTTPException(status_code=401, detail="Wrong username or password.")
        await conn.execute("UPDATE citizen_accounts SET failed_attempts = 0, locked_until = NULL, last_login_at = now() WHERE citizen_id = $1;", row["citizen_id"])
    return _session(row)


@router.post("/api/citizen/google")
async def google_sign_in(body: GoogleSignIn, request: Request):
    """Verify a Google ID token, then sign in (or sign up, with consent)."""
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=503, detail="Google sign-in is not set up yet.")
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get("https://oauth2.googleapis.com/tokeninfo", params={"id_token": body.credential})
    except httpx.HTTPError:
        raise HTTPException(status_code=502, detail="Couldn't reach Google. Please try again.")
    info = r.json() if r.status_code == 200 else {}
    if info.get("aud") != GOOGLE_CLIENT_ID or info.get("iss") not in ("accounts.google.com", "https://accounts.google.com") or str(info.get("email_verified")).lower() != "true":
        raise HTTPException(status_code=401, detail="Google sign-in failed. Please try again.")
    async with request.app.state.db_pool.acquire() as conn:
        row = await conn.fetchrow("SELECT * FROM citizen_accounts WHERE google_sub = $1;", info["sub"])
        if row is None:
            if not body.consent:
                # First time with this Google account: the page asks for consent, then sends it again.
                raise HTTPException(status_code=428, detail="consent_required")
            row = await conn.fetchrow(
                "INSERT INTO citizen_accounts (google_sub, email, display_name, consent_at, last_login_at) VALUES ($1, $2, $3, now(), now()) "
                "RETURNING citizen_id, username, email, display_name;",
                info["sub"], info.get("email"), info.get("given_name") or info.get("name"),
            )
        else:
            await conn.execute("UPDATE citizen_accounts SET last_login_at = now() WHERE citizen_id = $1;", row["citizen_id"])
    return _session(row)


@router.get("/api/citizen/me")
async def my_account(request: Request, me: dict = Depends(current_citizen)):
    async with request.app.state.db_pool.acquire() as conn:
        profile = await conn.fetchrow("SELECT language, entities, updated_at FROM citizen_profiles WHERE citizen_id = $1;", me["citizen_id"])
        history = await conn.fetch(
            "SELECT assessment_id, tier, score, programs, created_at FROM citizen_assessments WHERE citizen_id = $1 ORDER BY created_at DESC LIMIT 20;",
            me["citizen_id"],
        )
    return {
        "display_name": me["display_name"] or me["username"] or me["email"],
        "username": me["username"],
        "email": me["email"],
        "signed_in_with": "google" if me["google_sub"] else "password",
        "member_since": me["created_at"].date().isoformat(),
        "profile": {"language": profile["language"], "entities": profile["entities"], "updated_at": profile["updated_at"].isoformat()} if profile else None,
        "history": [
            {"assessment_id": str(h["assessment_id"]), "tier": h["tier"], "score": h["score"], "programs": h["programs"], "created_at": h["created_at"].isoformat()}
            for h in history
        ],
    }


@router.put("/api/citizen/profile")
async def save_profile(body: ProfileIn, request: Request, me: dict = Depends(current_citizen)):
    """Save the citizen's answers (only known questions, validated the same way as in the chat)."""
    clean = {}
    for slot, value in body.entities.items():
        if slot == "barangay_code" and isinstance(value, str):
            clean[slot] = value[:20]
        elif slot in chatflow.SLOTS:
            v = chatflow.coerce(slot, value)
            if v is not None:
                clean[slot] = v
    await save_citizen_profile(request, str(me["citizen_id"]), clean, chatflow.lang_of(body.language))
    return {"saved": len(clean)}


@router.delete("/api/citizen/me", status_code=204)
async def delete_account(request: Request, me: dict = Depends(current_citizen)):
    async with request.app.state.db_pool.acquire() as conn:
        await conn.execute("DELETE FROM citizen_accounts WHERE citizen_id = $1;", me["citizen_id"])


# --- used by the chat (routers/sessions.py) ------------------------------------------
async def load_citizen_profile(request: Request, citizen_id: str) -> dict:
    async with request.app.state.db_pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT p.entities, a.display_name, a.username, a.email FROM citizen_accounts a "
            "LEFT JOIN citizen_profiles p ON p.citizen_id = a.citizen_id WHERE a.citizen_id = $1::uuid;",
            citizen_id,
        )
    if row is None:
        return {}
    return {"entities": row["entities"] or {}, "name": row["display_name"] or row["username"] or (row["email"] or "").split("@")[0]}


async def save_citizen_profile(request: Request, citizen_id: str, entities: dict, language: str | None):
    async with request.app.state.db_pool.acquire() as conn:
        await conn.execute(
            "INSERT INTO citizen_profiles (citizen_id, language, entities, updated_at) VALUES ($1::uuid, $2, $3, now()) "
            "ON CONFLICT (citizen_id) DO UPDATE SET language = EXCLUDED.language, entities = EXCLUDED.entities, updated_at = now();",
            citizen_id, language, entities,
        )


async def save_citizen_assessment(request: Request, citizen_id: str, entities: dict, vulnerability: dict, evaluations: list[dict]):
    programs = [{"program_name": e["program_name"], "status": e["status"]} for e in evaluations]
    async with request.app.state.db_pool.acquire() as conn:
        await conn.execute(
            "INSERT INTO citizen_assessments (citizen_id, entities, tier, score, programs) VALUES ($1::uuid, $2, $3, $4, $5);",
            citizen_id, entities, vulnerability.get("tier"), vulnerability.get("score"), programs,
        )
