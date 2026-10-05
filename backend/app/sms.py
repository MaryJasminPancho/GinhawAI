"""One-way SMS, used by both sides: citizens' checklists and staff verification
/ password-reset codes. Two providers, chosen on the SMS Gateway page:

* "semaphore": the Semaphore API. The key comes from the admin console
  (system_config.sms_api_key) or, as a fallback, the SEMAPHORE_API_KEY env var.
* "android": an Android phone on the same network running the open-source
  "SMS Gateway for Android" app in Local Server mode. Texts go out from the
  phone's own SIM, so they use that SIM's load or unlimited-text promo.
"""

import os
import re

import httpx

from app import secretbox

# SMS is a future enhancement: email is the delivery channel for now. Everything
# below is kept and tested, so turning this on (and showing the SMS pages again
# in frontend/src/lib/features.ts) is all it takes to bring SMS back.
SMS_FEATURE_ENABLED = False

SEMAPHORE_URL = "https://api.semaphore.co/api/v4"
ANDROID_SECRET = "sms-gateway"


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


def provider(settings: dict) -> str:
    return "android" if settings.get("sms_provider") == "android" else "semaphore"


def android_password(settings: dict) -> str | None:
    token = settings.get("android_gateway_password")
    return secretbox.decrypt(token, ANDROID_SECRET) if token else None


def is_configured(settings: dict) -> bool:
    if provider(settings) == "android":
        return bool(settings.get("android_gateway_url") and settings.get("android_gateway_username") and android_password(settings))
    return bool(api_key(settings))


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
    """number is a normalized 09XXXXXXXXX. Returns {"status": "SENT"|"FAILED", "detail": ...}."""
    if not SMS_FEATURE_ENABLED:
        return {"status": "FAILED", "detail": "SMS isn't available yet (planned as a future enhancement)."}
    if not settings.get("sms_enabled", True):
        return {"status": "FAILED", "detail": "SMS sending is paused by the administrator."}
    if not is_configured(settings):
        return {"status": "FAILED", "detail": "The SMS gateway isn't set up yet."}
    if provider(settings) == "android":
        return await _send_android(settings, number, message)
    return await _send_semaphore(settings, api_key(settings), number, message)


async def _send_android(settings: dict, number: str, message: str) -> dict:
    url = settings["android_gateway_url"].rstrip("/") + "/message"
    payload = {"textMessage": {"text": message}, "phoneNumbers": ["+63" + number[1:]]}
    auth = (settings["android_gateway_username"], android_password(settings) or "")
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            res = await client.post(url, json=payload, auth=auth)
    except Exception as e:
        return {"status": "FAILED", "detail": f"Could not reach the phone gateway ({type(e).__name__}). Check that the phone is on the same Wi-Fi and the app says Online."}
    if res.status_code == 401:
        return {"status": "FAILED", "detail": "The phone gateway rejected the username or password."}
    if res.status_code >= 400:
        return {"status": "FAILED", "detail": f"The phone gateway refused the message (HTTP {res.status_code})."}
    try:
        state = str(res.json().get("state", "Pending")).upper()
    except Exception:
        state = "PENDING"
    return {"status": "FAILED" if state == "FAILED" else "SENT", "detail": state}


async def _send_semaphore(settings: dict, key: str, number: str, message: str) -> dict:
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
    """Semaphore credits left. None for the phone gateway (the SIM's load isn't visible)."""
    if provider(settings) == "android":
        return None
    key = api_key(settings)
    if not key:
        return None
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            res = await client.get(f"{SEMAPHORE_URL}/account", params={"apikey": key})
        return int(float(res.json().get("credit_balance")))
    except Exception:
        return None
