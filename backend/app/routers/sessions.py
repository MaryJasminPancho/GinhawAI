import json
import secrets
from fastapi import APIRouter, Request, HTTPException

from app.schemas import MessageIn
from app.config import SESSION_TTL_SECONDS
from app.ai.ai_parser import extract_entities

router = APIRouter()

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

    reply = f"Got it — noted what you shared so far: {state['entities']}"
    state["messages"].append({"from": "system", "text": reply})

    await request.app.state.redis.set(f"session:{session_id}", json.dumps(state), ex=SESSION_TTL_SECONDS)
    return {"session_id": session_id, "reply": reply, "entities": state["entities"]}