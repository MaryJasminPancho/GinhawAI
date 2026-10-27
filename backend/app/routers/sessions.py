"""Citizen assessment sessions (storyboard Figs. 14–22).

Everything a citizen types lives only in Redis for the session's lifetime and
is purged when the session ends (RA 10173). The only things written to
PostgreSQL are anonymized aggregates: demand_logs (barangay + tier + matched
programs), document_checks, sms_logs (masked number) and feedback_logs.
"""

import json
import math
import re
import secrets
import unicodedata
import uuid
import asyncio
import difflib

from fastapi import APIRouter, HTTPException, Request

from app import chatflow, jargon
from app.ai.slot_classifier import classify
from app.ai.ai_parser import extract_entities
from app.schemas import AssessmentFeedbackIn, DocumentChecksIn, EmailChecklistRequest, EntityPatch, MessageIn, SessionStart, SmsRequest
from app.scoring import derive_profile, evaluate_program, rank_programs, score_vulnerability, today_iso
from app.settings import get_settings
from app import mailer, sms
from app.mailer import build_checklist_email, mask_email, normalize_email, send_email
from app.sms import build_checklist_sms, mask_number, normalize_ph_number, send_sms

router = APIRouter()

# Kept for reference by other modules/tests; the real list lives in chatflow.SLOTS.
REQUIRED_FIELDS = chatflow.SLOTS

# Which fine-tuned classifier answers which chat question (slot name -> model key).
# Housing/crisis/yes_no are commented out until each passes the hand-written test
# (python scripts/evaluate_classifier.py <model>) with at least 80% accuracy.
SLOT_MODELS = {
    "employment_status": "employment_status",
    # "housing_type": "housing_type",
    # "crisis_type": "crisis_type",
    # "has_children_0_18": "yes_no",
    # "has_pwd": "yes_no",
    # "is_solo_parent": "yes_no",
}
# Minimum confidence before we trust a model's answer (below this we fall back to Gemini)
MODEL_MIN_CONF = 0.5

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


ROMAN = {"1": "i", "2": "ii"}  # "Sambag 2" = "Sambag II"


def _norm(name: str) -> str:
    name = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()  # "Niño" -> "Nino"
    name = re.sub(r"^(brgy\.?|barangay|bgy\.?)\s+", "", name.strip(), flags=re.I)
    name = re.sub(r"\b([12])\b", lambda m: ROMAN[m.group(1)], name.lower())
    name = re.sub(r"[^a-z0-9]", "", name)
    return re.sub(r"([b-df-hj-np-tv-z])\1+", r"\1", name)  # "Hipodromo" = "Hippodromo" (but keep "II")


# Other names people use for a barangay -> its PSGC code. Checked before any fuzzy match,
# so "Central" doesn't drift to Pahina Central or San Nicolas Central.
BARANGAY_ALIASES = {
    "0730600022": ["Central", "Central Proper", "Santo Niño", "Sto. Niño", "Sto Niño", "Señor Santo Niño", "Sr. Sto. Niño"],
}

# "Lahug, Cebu City" / "Mabolo Cebu" -> the barangay part only.
CITY_SUFFIX = re.compile(r"(?:[,\s]*(?:cebu\s*city|cebu|city|ph|philippines))+[\s.]*$", re.I)


async def _barangay_rows(request: Request):
    async with request.app.state.db_pool.acquire() as conn:
        return await conn.fetch("SELECT barangay_code, barangay_name FROM barangays;")


async def _resolve_barangay(request: Request, text: str) -> tuple[str, str | None]:
    """Match what the citizen typed to a barangay in the database. Returns (name, code);
    the code is None when it isn't a known barangay, and then the answer is not accepted."""
    rows = await _barangay_rows(request)
    typed = _norm(CITY_SUFFIX.sub("", str(text).strip()))
    if not typed:
        return str(text).strip(), None
    aliases = {_norm(a): code for code, names_ in BARANGAY_ALIASES.items() for a in names_}
    if typed in aliases:
        hit = next((r for r in rows if r["barangay_code"] == aliases[typed]), None)
        if hit:
            return hit["barangay_name"], hit["barangay_code"]
    names = [(r, _norm(r["barangay_name"])) for r in rows]
    # Best match first: exact, then "starts with" ("Sambag" -> Sambag I), then
    # contains ("Padilla" -> T. Padilla), then a close spelling ("Kasambagn" -> Kasambagan).
    # Among several, the shortest name wins.
    tests = [lambda n: n == typed]
    if len(typed) >= 4:
        tests += [
            lambda n: n.startswith(typed),
            lambda n: typed in n,
            lambda n: difflib.SequenceMatcher(None, typed, n).ratio() >= 0.88,
        ]
    for test in tests:
        hits = sorted((r for r, n in names if test(n)), key=lambda r: len(r["barangay_name"]))
        if hits:
            return hits[0]["barangay_name"], hits[0]["barangay_code"]
    # A short sentence that names one ("taga Guadalupe ko", "sa Lahug po"): the longest
    # barangay name (or alias) found as whole words wins, so "Pahina Central" beats "Central".
    def words(s: str) -> str:
        s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()
        return " " + re.sub(r"\b([12])\b", lambda m: ROMAN[m.group(1)], re.sub(r"[^a-z0-9]+", " ", s)).strip() + " "

    said = words(str(text))
    if len(said.split()) <= 8:
        phrases = [(words(r["barangay_name"]), r) for r in rows]
        phrases += [(words(a), r) for r in rows for a in BARANGAY_ALIASES.get(r["barangay_code"], [])]
        found = [(p, r) for p, r in phrases if p in said]
        if found:
            best = max(found, key=lambda pr: len(pr[0]))[1]
            return best["barangay_name"], best["barangay_code"]
    return str(text).strip(), None


async def _suggest_barangays(request: Request, text: str) -> list[str]:
    """Up to 3 barangay names that look like what the citizen typed, for quick replies."""
    rows = await _barangay_rows(request)
    typed = _norm(CITY_SUFFIX.sub("", str(text).strip()))
    if len(typed) < 3:
        return []
    by_norm = {_norm(r["barangay_name"]): r["barangay_name"] for r in rows}
    return [by_norm[n] for n in difflib.get_close_matches(typed, list(by_norm), n=3, cutoff=0.6)]


async def _apply(request: Request, entities: dict, slot: str, value) -> bool:
    value = chatflow.coerce(slot, value)
    if value is None:
        return False
    if slot == "barangay":
        name, code = await _resolve_barangay(request, value)
        if code is None:  # not a Cebu City barangay: never saved
            return False
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


@router.get("/api/sessions/{session_id}/messages")
async def session_history(session_id: str, request: Request):
    """The conversation so far ("View Interview Sequence History"), so the chat
    screen can be restored after a page refresh. Lives only as long as the session."""
    state = await _load(request, session_id)
    await request.app.state.redis.expire(_key(session_id), _ttl(request))
    lang = state.get("lang", "en")
    asking = state.get("asking")
    progress = _progress(state)
    return {
        "session_id": session_id,
        "language": lang,
        "messages": state.get("messages", []),
        "asking": asking,
        "quick_replies": chatflow.quick_replies(asking, lang) if asking else [],
        "is_complete": progress["profile_complete"],
    }


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
    model_used = False  # becomes True when the XLM-R classifier answered this question

    # 1) A direct answer to the question just asked (chip tap, "oo", "5", "8k"…).
    if asking:
        direct = chatflow.parse_for_slot(asking, text, lang, jargon.synonyms())
        if direct is not None:
            understood = await _apply(request, entities, asking, direct)

    # 1b) Fine-tuned XLM-RoBERTa classifier for the question being asked (see SLOT_MODELS).
    #     Only runs if the rule parser above did not understand the answer.
    #     Low confidence or "unclear" -> we fall through to Gemini below.
    model_key = SLOT_MODELS.get(asking)
    if model_key and not understood:
        try:
            label, conf = await asyncio.to_thread(classify, text, model_key)  # to_thread: keeps the server responsive while the model runs
            print(f"[classifier:{model_key}] {text!r} -> {label} ({conf})")   # debug line: shows what the model decided
            if label != "unclear" and conf >= MODEL_MIN_CONF:
                value = (label == "yes") if model_key == "yes_no" else label  # yes/no slots store True/False
                understood = await _apply(request, entities, asking, value)
                model_used = understood
        except Exception as e:  # never let the model break the chat
            print(f"Classifier error: {e}")

    # 2) Free text may contain several answers at once — let the AI extract them.
    #    Skipped for short replies the parser already handled.

    # Skip Gemini when the answer is short, or when the XLM-R model already answered the question.
    if not (understood and (len(text.split()) <= 3 or model_used)):
        try:
            ai = await extract_entities(text, chatflow.question(asking, "en") if asking else "(done)")
        except Exception as e:  # never let the AI break the chat
            print(f"AI extraction error: {e}")
            ai = {}
        if isinstance(ai, dict):
            for slot in chatflow.SLOTS:
                # don't let Gemini overwrite an answer the XLM-R model already gave
                if ai.get(slot) is not None and (entities.get(slot) is None or (slot == asking and not model_used)):
                    if await _apply(request, entities, slot, ai[slot]):
                        understood = True

    state.pop("assessment", None)  # answers changed -> recompute later
    chatflow.auto_answer(entities)
    nxt = chatflow.next_slot(entities)
    state["asking"] = nxt
    quick = None  # barangay suggestions replace the usual chips
    if nxt is None:
        reply = chatflow.DONE[lang]
    elif nxt == asking and not understood and nxt == "barangay":
        suggestions = await _suggest_barangays(request, text)
        reply = chatflow.BARANGAY_UNKNOWN[lang] + (chatflow.BARANGAY_SUGGEST[lang] if suggestions else "")
        quick = [{"value": s, "label": s} for s in suggestions]
    elif nxt == asking and not understood:
        reply = chatflow.RETRY[lang] + chatflow.question(nxt, lang)
    else:
        reply = chatflow.question(nxt, lang)
    state["messages"].append({"from": "assistant", "text": reply})
    await _save(request, session_id, state)

    progress = _progress(state)
    return {
        "session_id": session_id,
        "reply": reply,
        "asking": nxt,
        "quick_replies": quick if quick is not None else chatflow.quick_replies(nxt, lang),
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
            errors[field] = "Not a barangay in Cebu City" if field == "barangay" else "Invalid value"
    state.pop("assessment", None)
    chatflow.auto_answer(entities)
    state["asking"] = chatflow.next_slot(entities)
    await _save(request, session_id, state)
    return {**_progress(state), "errors": errors}


# ---------------------------------------------------------------------------
# Scoring + explainable eligibility (Figs. 18–21)
# ---------------------------------------------------------------------------
async def barangay_hazards(conn, code: str | None = None, name: str | None = None) -> dict:
    """Flood / landslide / storm surge level of a barangay (Appendix R #26); {} if unknown."""
    if not code and not name:
        return {}
    row = await conn.fetchrow(
        "SELECT flood_level, landslide_level, storm_surge_level FROM barangays "
        "WHERE barangay_code = $1 OR ($1::text IS NULL AND lower(barangay_name) = lower($2));",
        code, name,
    )
    return {k: v for k, v in dict(row).items() if v} if row else {}


@router.post("/api/sessions/{session_id}/assess")
async def assess(session_id: str, request: Request):
    state = await _load(request, session_id)
    progress = _progress(state)
    if not progress["profile_complete"]:
        raise HTTPException(status_code=409, detail=f"Some answers are missing: {', '.join(progress['missing_fields'])}")
    lang = state.get("lang", "en")

    async with request.app.state.db_pool.acquire() as conn:
        hazards = await barangay_hazards(conn, state["entities"].get("barangay_code"))
        profile = derive_profile({**state["entities"], **hazards})
        vulnerability = score_vulnerability(profile, lang)
        programs = await conn.fetch("SELECT program_id, program_name, agency, scope FROM programs WHERE is_active ORDER BY program_name;")
        criteria = await conn.fetch("SELECT program_id, attribute, operator, threshold_value, weight FROM eligibility_criteria;")
        docs = await conn.fetch("SELECT doc_id, program_id, document_name, is_mandatory, notes, for_crisis FROM document_requirements ORDER BY is_mandatory DESC, document_name;")
        offices = await conn.fetch(
            "SELECT office_id, office_name, address, barangay_code, contact_number, operating_hours FROM lgu_offices ORDER BY office_name;"
        )
        schedules = await conn.fetch(
            "SELECT s.schedule_id, s.program_id, s.office_id, s.start_date, s.end_date, s.notes, o.office_name, o.address "
            "FROM barangay_schedules s JOIN lgu_offices o ON o.office_id = s.office_id "
            "WHERE s.end_date >= CURRENT_DATE ORDER BY s.start_date;"
        )
        coords = {r["barangay_code"]: (r["latitude"], r["longitude"]) for r in await conn.fetch("SELECT barangay_code, latitude, longitude FROM barangays;")}

        by_program: dict[str, list] = {}
        for c in criteria:
            by_program.setdefault(str(c["program_id"]), []).append(dict(c))
        evaluations = rank_programs([evaluate_program(dict(p), by_program.get(str(p["program_id"]), []), profile, lang) for p in programs])

        docs_by_program: dict[str, list] = {}
        crisis = profile.get("crisis_type")
        for d in docs:
            if d["for_crisis"] and d["for_crisis"] != crisis:
                continue  # e.g. AICS burial papers only when there was a death
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

        # "Where to go" (Fig. 21): the nearest relevant offices.
        #   1. offices in the citizen's own barangay
        #   2. offices running a current schedule for a program the citizen matched
        #   3. everything else, nearest first (by barangay map coordinates)
        # Other barangays' halls are skipped — they only serve their own residents.
        code = state["entities"].get("barangay_code")
        matched = [e for e in evaluations if e["status"] in ("qualified", "partial")]
        matched_ids = {e["program_id"] for e in matched}
        hosting = {str(s["office_id"]) for s in schedules if str(s["program_id"]) in matched_ids}
        here = coords.get(code)

        def other_barangay_hall(o):
            return o["barangay_code"] and o["barangay_code"] != code and re.match(r"(barangay|brgy\.?)\s", o["office_name"], re.I)

        def distance(o):
            there = coords.get(o["barangay_code"])
            if not here or not there or None in here or None in there:
                return float("inf")
            return math.hypot(here[0] - there[0], here[1] - there[1])

        def rank(o):
            tier = 0 if code and o["barangay_code"] == code else 1 if str(o["office_id"]) in hosting else 2
            return (tier, distance(o), o["office_name"])

        office_list = sorted((dict(o) for o in offices if not other_barangay_hall(o)), key=rank)
        office_list = [{**o, "office_id": str(o["office_id"])} for o in office_list[:3]]

        # Anonymized demand log — once per session (Fig. 22 / Table 16).
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
# Which ways the checklist can be sent (the results page only shows these)
# ---------------------------------------------------------------------------
@router.get("/api/channels")
async def delivery_channels(request: Request):
    s = get_settings(request)
    return {
        "sms": sms.SMS_FEATURE_ENABLED and sms.is_configured(s) and bool(s.get("sms_enabled", True)),
        "email": mailer.is_configured(s) and bool(s.get("email_enabled", True)),
    }


def _chosen_programs(assessment: dict, program_ids: list[str] | None) -> list[dict]:
    chosen = [p for p in assessment["programs"] if p["status"] in ("qualified", "partial")]
    if program_ids:
        chosen = [p for p in assessment["programs"] if p["program_id"] in program_ids]
    if not chosen:
        raise HTTPException(status_code=422, detail="There are no matched programs to send.")
    return chosen


# ---------------------------------------------------------------------------
# Email checklist (optional; free alternative to SMS). The address is used once
# and never stored; only a masked form is logged.
# ---------------------------------------------------------------------------
@router.post("/api/sessions/{session_id}/email")
async def send_checklist_email(session_id: str, payload: EmailChecklistRequest, request: Request):
    state = await _load(request, session_id)
    assessment = state.get("assessment")
    if not assessment:
        raise HTTPException(status_code=409, detail="Please finish the assessment first.")
    email = normalize_email(payload.email)
    if email is None:
        raise HTTPException(status_code=422, detail="Enter a valid email address, like name@gmail.com.")
    if state.get("emails_sent", 0) >= 3:
        raise HTTPException(status_code=429, detail="You've already emailed this checklist 3 times.")

    chosen = _chosen_programs(assessment, payload.program_ids)
    subject, body = build_checklist_email(chosen, assessment.get("offices", []))
    result = await send_email(get_settings(request), email, subject, body)

    async with request.app.state.db_pool.acquire() as conn:
        await conn.execute(
            "INSERT INTO email_logs (masked_recipient, program_id, delivery_status) VALUES ($1, $2::uuid, $3);",
            mask_email(email), chosen[0]["program_id"], result["status"],
        )
    state["emails_sent"] = state.get("emails_sent", 0) + (1 if result["status"] != "FAILED" else 0)
    await _save(request, session_id, state)
    if result["status"] == "FAILED":
        raise HTTPException(status_code=502, detail=f"{result['detail']} Please save or screenshot your checklist instead.")
    return {"status": result["status"], "masked_recipient": mask_email(email)}


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
        raise HTTPException(status_code=502, detail=f"{result['detail']} Please save or screenshot your checklist instead.")
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