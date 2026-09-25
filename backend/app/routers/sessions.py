import json
import secrets
from fastapi import APIRouter, Request, HTTPException

from app.schemas import MessageIn, BarangayIn
from app.config import SESSION_TTL_SECONDS
from app.ai.ai_parser import extract_entities

router = APIRouter()

REQUIRED_FIELDS = ["monthly_income", "number_of_dependents", "is_unemployed", "has_pwd"]

@router.post("/api/sessions", status_code=201)
async def start_session(request: Request):
    session_id = secrets.token_urlsafe(24)
    initial_state = {"messages": []}
    await request.app.state.redis.set(f"session:{session_id}", json.dumps(initial_state), ex=SESSION_TTL_SECONDS)
    return {"session_id": session_id, "expires_in_seconds": SESSION_TTL_SECONDS}

@router.get("/api/sessions/{session_id}")
async def get_session(session_id: str, request: Request):
    raw = await request.app.state.redis.get(f"session:{session_id}")
    if raw is None:
        raise HTTPException(status_code=404, detail="Session not found or expired")
    await request.app.state.redis.expire(f"session:{session_id}", SESSION_TTL_SECONDS)
    return {"session_id": session_id, "state": json.loads(raw)}

@router.post("/api/sessions/{session_id}/messages")
async def send_message(session_id: str, payload: MessageIn, request: Request):
    raw = await request.app.state.redis.get(f"session:{session_id}")
    if raw is None:
        raise HTTPException(status_code=404, detail="Session not found or expired")

    state = json.loads(raw)
    state.setdefault("messages", []).append({"from": "citizen", "text": payload.message})

    entities = await extract_entities(payload.message)
    existing = state.get("entities", {})
    state["entities"] = {**existing, **{k: v for k, v in entities.items() if v is not None}}

    # Deterministic slot-filling — deliberately separate from the AI extraction step above.
    # Mirrors how the real XLM-RoBERTa model will only ever handle extraction, never flow control.
    missing_fields = [f for f in REQUIRED_FIELDS if state["entities"].get(f) is None]
    profile_complete = len(missing_fields) == 0

    system_message = (
        "All required information collected — ready for vulnerability scoring."
        if profile_complete
        else f"Still need: {', '.join(missing_fields)}"
    )
    state["messages"].append({"from": "system", "text": system_message})

    await request.app.state.redis.set(f"session:{session_id}", json.dumps(state), ex=SESSION_TTL_SECONDS)

    return {
        "session_id": session_id,
        "entities": state["entities"],
        "missing_fields": missing_fields,
        "profile_complete": profile_complete,
        "system_message": system_message,
    }

@router.patch("/api/sessions/{session_id}/barangay")
async def set_session_barangay(session_id: str, payload: BarangayIn, request: Request):
    raw = await request.app.state.redis.get(f"session:{session_id}")
    if raw is None:
        raise HTTPException(status_code=404, detail="Session not found or expired")

    # Validate against the real barangays table — never trust a citizen-supplied code blindly
    async with request.app.state.db_pool.acquire() as conn:
        exists = await conn.fetchval("SELECT 1 FROM barangays WHERE barangay_code = $1;", payload.barangay_code)
    if not exists:
        raise HTTPException(status_code=400, detail="Unknown barangay_code")

    state = json.loads(raw)
    state["barangay_code"] = payload.barangay_code
    await request.app.state.redis.set(f"session:{session_id}", json.dumps(state), ex=SESSION_TTL_SECONDS)
    return {"session_id": session_id, "barangay_code": payload.barangay_code}


@router.delete("/api/sessions/{session_id}", status_code=204)
async def reset_session(session_id: str, request: Request):
    await request.app.state.redis.delete(f"session:{session_id}")
    return None