"""Citizen assessment sessions (storyboard Figs. 14–22).

Everything a citizen types lives only in Redis for the session's lifetime and
is purged when the session ends (RA 10173). The only things written to
PostgreSQL are anonymized aggregates: demand_logs (barangay + tier + matched
programs), document_checks, sms_logs (masked number) and feedback_logs.
"""

import json
import re
import secrets
import uuid

from fastapi import APIRouter, HTTPException, Request

from app import chatflow
from app.ai.ai_parser import extract_entities
from app.schemas import AssessmentFeedbackIn, DocumentChecksIn, EntityPatch, MessageIn, SessionStart, SmsRequest
from app.scoring import derive_profile, evaluate_program, rank_programs, score_vulnerability, today_iso
from app.settings import get_settings
from app.sms import build_checklist_sms, mask_number, normalize_ph_number, send_sms

router = APIRouter()

# Kept for reference by other modules/tests; the real list lives in chatflow.SLOTS.
REQUIRED_FIELDS = chatflow.SLOTS


def _key(session_id: str) -> str:
    return f"session:{session_id}"


def _ttl(request: Request) -> int:
    return int(get_settings(request).get("session_ttl_minutes", 30)) * 60


async def _load(request: Request, session_id: str) -> dict:
    raw = await request.app.state.redis.get(_key(session_id))
    if raw is None:
        raise HTTPException(status_code=404, detail="Session not found or expired. Please start again.")
    return json.loads(raw)


async def _save(request: Request, session_id: str, state: dict):
    await request.app.state.redis.set(_key(session_id), json.dumps(state), ex=_ttl(request))


def _norm(name: str) -> str:
    name = re.sub(r"^(brgy\.?|barangay|bgy\.?)\s+", "", name.strip(), flags=re.I)
    return re.sub(r"[^a-z0-9]", "", name.lower())


async def _resolve_barangay(request: Request, text: str) -> tuple[str, str | None]:
    """Match what the citizen typed to a barangay in the database."""
    async with request.app.state.db_pool.acquire() as conn:
        rows = await conn.fetch("SELECT barangay_code, barangay_name FROM barangays;")
    typed = _norm(text)
    if not typed:
        return text, None
    for r in rows:
        if _norm(r["barangay_name"]) == typed:
            return r["barangay_name"], r["barangay_code"]
    for r in rows:
        n = _norm(r["barangay_name"])
        if len(typed) >= 4 and (n.startswith(typed) or typed.startswith(n) or typed in n):
            return r["barangay_name"], r["barangay_code"]
    return text.strip(), None


async def _apply(request: Request, entities: dict, slot: str, value) -> bool:
    value = chatflow.coerce(slot, value)
    if value is None:
        return False
    if slot == "barangay":
        name, code = await _resolve_barangay(request, value)
        entities["barangay"] = name
        entities["barangay_code"] = code
    else:
        entities[slot] = value
    return True


def _progress(state: dict) -> dict:
    entities = state.get("entities", {})
    missing = [s for s in chatflow.SLOTS if entities.get(s) is None]
    return {"entities": entities, "missing_fields": missing, "profile_complete": not missing}


# ---------------------------------------------------------------------------
# Session lifecycle
# ---------------------------------------------------------------------------
@router.post("/api/sessions", status_code=201)
async def start_session(request: Request, body: SessionStart | None = None):
    lang = chatflow.lang_of(body.language if body else None)
    session_id = secrets.token_urlsafe(24)
    first = chatflow.SLOTS[0]
    greeting = chatflow.GREETING[lang]
    q = chatflow.question(first, lang)
    state = {
        "lang": lang,
        "entities": {},
        "asking": first,
        "messages": [{"from": "assistant", "text": greeting}, {"from": "assistant", "text": q}],
    }
    await _save(request, session_id, state)
    return {
        "session_id": session_id,
        "expires_in_seconds": _ttl(request),
        "language": lang,
        "messages": [greeting, q],
        "asking": first,
        "quick_replies": chatflow.quick_replies(first, lang),
    }


@router.get("/api/sessions/{session_id}")
async def get_session(session_id: str, request: Request):
    state = await _load(request, session_id)
    await request.app.state.redis.expire(_key(session_id), _ttl(request))
    return {"session_id": session_id, "language": state.get("lang", "en"), **_progress(state), "assessment": state.get("assessment")}


@router.delete("/api/sessions/{session_id}")
async def end_session(session_id: str, request: Request):
    """Session end (Fig. 22): purge everything the citizen told us."""
    if get_settings(request).get("purge_on_session_end", True):
        await request.app.state.redis.delete(_key(session_id))
        return {"purged": True}
    return {"purged": False}


# ---------------------------------------------------------------------------
# Conversation (Fig. 16)
# ---------------------------------------------------------------------------
@router.post("/api/sessions/{session_id}/messages")
async def send_message(session_id: str, payload: MessageIn, request: Request):
    text = payload.message.strip()
    if not text:
        raise HTTPException(status_code=422, detail="Message is empty")
    if len(text) > 1000:
        raise HTTPException(status_code=422, detail="Message is too long")

    state = await _load(request, session_id)
    lang = state.get("lang", "en")
    entities = state.setdefault("entities", {})
    asking = state.get("asking") or chatflow.next_slot(entities)
    state.setdefault("messages", []).append({"from": "citizen", "text": text})

    understood = False
    # 1) A direct answer to the question just asked (chip tap, "oo", "5", "8k"…).
    if asking:
        direct = chatflow.parse_for_slot(asking, text, lang)
        if direct is not None and asking == "barangay":
            # Free text could be a greeting — only take it as-is if it matches a
            # known barangay, or if we've already asked once.
            name, code = await _resolve_barangay(request, direct)
            if code or state.get("barangay_retry"):
                entities["barangay"], entities["barangay_code"] = name, code
                understood = True
        elif direct is not None:
            understood = await _apply(request, entities, asking, direct)

    # 2) Free text may contain several answers at once — let the AI extract them.
    #    Skipped for short replies the parser already handled.
    if not (understood and len(text.split()) <= 3):
        try:
            ai = await extract_entities(text, chatflow.question(asking, "en") if asking else "(done)")
        except Exception as e:  # never let the AI break the chat
            print(f"AI extraction error: {e}")
            ai = {}
        if isinstance(ai, dict):
            for slot in chatflow.SLOTS:
                if ai.get(slot) is not None and (entities.get(slot) is None or slot == asking):
                    if await _apply(request, entities, slot, ai[slot]):
                        understood = True

    state.pop("assessment", None)  # answers changed -> recompute later
    nxt = chatflow.next_slot(entities)
    state["asking"] = nxt
    if nxt is None:
        reply = chatflow.DONE[lang]
    elif nxt == asking and not understood:
        reply = chatflow.RETRY[lang] + chatflow.question(nxt, lang)
        if nxt == "barangay":
            state["barangay_retry"] = True
    else:
        reply = chatflow.question(nxt, lang)
    state["messages"].append({"from": "assistant", "text": reply})
    await _save(request, session_id, state)

    progress = _progress(state)
    return {
        "session_id": session_id,
        "reply": reply,
        "asking": nxt,
        "quick_replies": chatflow.quick_replies(nxt, lang),
        "is_complete": progress["profile_complete"],
        **progress,
        # kept for backward compatibility with earlier clients
        "system_message": "All required information collected — ready for vulnerability scoring."
        if progress["profile_complete"] else f"Still need: {', '.join(progress['missing_fields'])}",
    }


# ---------------------------------------------------------------------------
# Data confirmation with per-field edit (Fig. 17)
# ---------------------------------------------------------------------------
@router.patch("/api/sessions/{session_id}/entities")
async def edit_entities(session_id: str, payload: EntityPatch, request: Request):
    state = await _load(request, session_id)
    entities = state.setdefault("entities", {})
    errors = {}
    for field, value in payload.values.items():
        if field not in chatflow.SLOTS:
            errors[field] = "Unknown field"
            continue
        if not await _apply(request, entities, field, value):
            errors[field] = "Invalid value"
    state.pop("assessment", None)
    state["asking"] = chatflow.next_slot(entities)
    await _save(request, session_id, state)
    return {**_progress(state), "errors": errors}


# ---------------------------------------------------------------------------
# Scoring + explainable eligibility (Figs. 18–21)
# ---------------------------------------------------------------------------
@router.post("/api/sessions/{session_id}/assess")
async def assess(session_id: str, request: Request):
    state = await _load(request, session_id)
    progress = _progress(state)
    if not progress["profile_complete"]:
        raise HTTPException(status_code=409, detail=f"Some answers are missing: {', '.join(progress['missing_fields'])}")
    lang = state.get("lang", "en")
    profile = derive_profile(state["entities"])
    vulnerability = score_vulnerability(profile, lang)

    async with request.app.state.db_pool.acquire() as conn:
        programs = await conn.fetch("SELECT program_id, program_name, agency, scope FROM programs WHERE is_active ORDER BY program_name;")
        criteria = await conn.fetch("SELECT program_id, attribute, operator, threshold_value, weight FROM eligibility_criteria;")
        docs = await conn.fetch("SELECT doc_id, program_id, document_name, is_mandatory, notes FROM document_requirements ORDER BY is_mandatory DESC, document_name;")
        offices = await conn.fetch(
            "SELECT office_id, office_name, address, barangay_code, contact_number, operating_hours FROM lgu_offices ORDER BY office_name;"
        )
        schedules = await conn.fetch(
            "SELECT s.schedule_id, s.program_id, s.start_date, s.end_date, s.notes, o.office_name, o.address "
            "FROM barangay_schedules s JOIN lgu_offices o ON o.office_id = s.office_id "
            "WHERE s.end_date >= CURRENT_DATE ORDER BY s.start_date;"
        )

        by_program: dict[str, list] = {}
        for c in criteria:
            by_program.setdefault(str(c["program_id"]), []).append(dict(c))
        evaluations = rank_programs([evaluate_program(dict(p), by_program.get(str(p["program_id"]), []), profile) for p in programs])

        docs_by_program: dict[str, list] = {}
        for d in docs:
            docs_by_program.setdefault(str(d["program_id"]), []).append(
                {"doc_id": str(d["doc_id"]), "document_name": d["document_name"], "is_mandatory": d["is_mandatory"], "notes": d["notes"]}
            )
        for e in evaluations:
            e["documents"] = docs_by_program.get(e["program_id"], [])
            e["schedules"] = [
                {"schedule_id": str(s["schedule_id"]), "start_date": s["start_date"].isoformat(), "end_date": s["end_date"].isoformat(),
                 "notes": s["notes"], "office_name": s["office_name"], "address": s["address"]}
                for s in schedules if str(s["program_id"]) == e["program_id"]
            ]

        # Offices in the citizen's barangay first, then the rest.
        code = state["entities"].get("barangay_code")
        office_list = sorted((dict(o) for o in offices), key=lambda o: 0 if code and o["barangay_code"] == code else 1)
        office_list = [{**o, "office_id": str(o["office_id"])} for o in office_list[:3]]

        # Anonymized demand log — once per session (Fig. 22 / Table 16).
        matched = [e for e in evaluations if e["status"] in ("qualified", "partial")]
        if not state.get("demand_logged"):
            assessment_id = uuid.uuid4()
            async with conn.transaction():
                if matched:
                    for e in matched:
                        await conn.execute(
                            "INSERT INTO demand_logs (assessment_id, program_id, barangay_code, vulnerability_tier) VALUES ($1, $2::uuid, $3, $4);",
                            assessment_id, e["program_id"], code, vulnerability["tier"],
                        )
                else:
                    await conn.execute(
                        "INSERT INTO demand_logs (assessment_id, program_id, barangay_code, vulnerability_tier) VALUES ($1, NULL, $2, $3);",
                        assessment_id, code, vulnerability["tier"],
                    )
            state["demand_logged"] = True

    assessment = {
        "vulnerability": vulnerability,
        "programs": evaluations,
        "offices": office_list,
        "barangay": state["entities"].get("barangay"),
        "assessed_on": today_iso(),
    }
    state["assessment"] = assessment
    await _save(request, session_id, state)
    return assessment


@router.post("/api/sessions/{session_id}/document-checks")
async def document_checks(session_id: str, payload: DocumentChecksIn, request: Request):
    """Citizen ticks the documents they already have (feeds the Document Deficiency Report)."""
    state = await _load(request, session_id)
    already = set(state.get("docs_checked", []))
    new = [c for c in payload.checks if c.doc_id not in already]
    if new:
        async with request.app.state.db_pool.acquire() as conn:
            await conn.executemany(
                "INSERT INTO document_checks (doc_id, has_document) VALUES ($1::uuid, $2);",
                [(c.doc_id, c.has_document) for c in new],
            )
        state["docs_checked"] = list(already | {c.doc_id for c in new})
        await _save(request, session_id, state)
    return {"recorded": len(new)}


# ---------------------------------------------------------------------------
# SMS checklist (Figs. 21–22)
# ---------------------------------------------------------------------------
@router.post("/api/sessions/{session_id}/sms")
async def send_checklist_sms(session_id: str, payload: SmsRequest, request: Request):
    state = await _load(request, session_id)
    assessment = state.get("assessment")
    if not assessment:
        raise HTTPException(status_code=409, detail="Please finish the assessment first.")
    number = normalize_ph_number(payload.phone)
    if number is None:
        raise HTTPException(status_code=422, detail="Enter an 11-digit mobile number starting with 09.")
    if state.get("sms_sent", 0) >= 3:
        raise HTTPException(status_code=429, detail="You've already sent this checklist 3 times.")

    chosen = [p for p in assessment["programs"] if p["status"] in ("qualified", "partial")]
    if payload.program_ids:
        chosen = [p for p in assessment["programs"] if p["program_id"] in payload.program_ids]
    if not chosen:
        raise HTTPException(status_code=422, detail="There are no matched programs to send.")

    message = build_checklist_sms(chosen, assessment.get("offices", []))
    result = await send_sms(get_settings(request), number, message)

    async with request.app.state.db_pool.acquire() as conn:
        await conn.execute(
            "INSERT INTO sms_logs (masked_recipient, program_id, delivery_status) VALUES ($1, $2::uuid, $3);",
            mask_number(number), chosen[0]["program_id"], result["status"],
        )
    state["sms_sent"] = state.get("sms_sent", 0) + (1 if result["status"] != "FAILED" else 0)
    await _save(request, session_id, state)
    if result["status"] == "FAILED":
        raise HTTPException(status_code=502, detail=result["detail"])
    return {"status": result["status"], "masked_recipient": mask_number(number), "message": message}


# ---------------------------------------------------------------------------
# Usability feedback (Table 18) — anonymous, not linked to the session
# ---------------------------------------------------------------------------
@router.post("/api/feedback", status_code=201)
async def submit_feedback(payload: AssessmentFeedbackIn, request: Request):
    # Standard SUS: odd items score (x-1), even items (5-x); sum × 2.5.
    a = payload.answers
    raw = sum((a[i] - 1) if i % 2 == 0 else (5 - a[i]) for i in range(10))
    sus = round(raw * 2.5)
    comment = (payload.comment or "").strip()[:1000] or None
    async with request.app.state.db_pool.acquire() as conn:
        await conn.execute("INSERT INTO feedback_logs (sus_score, qualitative_feedback) VALUES ($1, $2);", sus, comment)
    return {"sus_score": sus}