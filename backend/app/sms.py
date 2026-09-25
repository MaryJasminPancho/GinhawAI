"""Semaphore SMS gateway (one-way). The API key comes from the admin console
(system_config.sms_api_key) or, as a fallback, the SEMAPHORE_API_KEY env var."""

import os
import re

import httpx

SEMAPHORE_URL = "https://api.semaphore.co/api/v4"


def normalize_ph_number(raw: str) -> str | None:
    digits = re.sub(r"\D", "", raw or "")
    if digits.startswith("63") and len(digits) == 12:
        digits = "0" + digits[2:]
    return digits if re.fullmatch(r"09\d{9}", digits) else None


def mask_number(number: str) -> str:
    # 09171234567 -> 0917****567 (RA 10173 data minimization)
    return f"{number[:4]}****{number[-3:]}"


def api_key(settings: dict) -> str | None:
    return settings.get("sms_api_key") or os.getenv("SEMAPHORE_API_KEY")


def short_name(program_name: str) -> str:
    m = re.search(r"\(([^)]+)\)", program_name)
    return m.group(1) if m else program_name[:30]


def build_checklist_sms(programs: list[dict], offices: list[dict]) -> str:
    lines = ["GinhawAI checklist:"]
    for p in programs[:3]:
        docs = [d["document_name"] for d in p.get("documents", []) if d.get("is_mandatory")] or [d["document_name"] for d in p.get("documents", [])]
        lines.append(f"{short_name(p['program_name'])}: " + ("; ".join(docs[:4]) if docs else "ask the office"))
    if offices:
        o = offices[0]
        office = o["office_name"]
        if o.get("operating_hours"):
            office += f", {o['operating_hours']}"
        if o.get("contact_number"):
            office += f", {o['contact_number']}"
        lines.append(f"Go to: {office}")
    lines.append("Final eligibility is decided by the office.")
    return "\n".join(lines)


async def send_sms(settings: dict, number: str, message: str) -> dict:
    if not settings.get("sms_enabled", True):
        return {"status": "FAILED", "detail": "SMS sending is paused by the administrator."}
    key = api_key(settings)
    if not key:
        return {"status": "FAILED", "detail": "The SMS gateway isn't set up yet. Please save or screenshot your checklist instead."}
    data = {"apikey": key, "number": number, "message": message}
    if settings.get("sms_sender_name"):
        data["sendername"] = settings["sms_sender_name"]
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            res = await client.post(f"{SEMAPHORE_URL}/messages", data=data)
        body = res.json()
    except Exception as e:
        return {"status": "FAILED", "detail": f"Could not reach the SMS gateway ({type(e).__name__})."}
    if res.status_code >= 400 or not isinstance(body, list) or not body:
        return {"status": "FAILED", "detail": "The SMS gateway rejected the message."}
    status = str(body[0].get("status", "Pending")).upper()
    return {"status": "FAILED" if status == "FAILED" else "SENT", "detail": status}


async def account_balance(settings: dict) -> int | None:
    key = api_key(settings)
    if not key:
        return None
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            res = await client.get(f"{SEMAPHORE_URL}/account", params={"apikey": key})
        return int(float(res.json().get("credit_balance")))
    except Exception:
        return None
