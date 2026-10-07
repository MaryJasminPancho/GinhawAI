"""One-way email, used by both sides: citizens can have their checklist emailed
(optional), and staff receive verification and password-reset codes.

Sent through an SMTP account set on the System Administrator's Email Gateway
page, normally a team Gmail account with a Google "app password" (free, about
500 emails a day). The app password is stored encrypted, never in a file.
"""

import asyncio
import re
import smtplib
import ssl
from email.message import EmailMessage
from email.utils import formataddr

from app import secretbox

SECRET_PURPOSE = "email-gateway"
EMAIL_RE = re.compile(r"^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$")


def normalize_email(raw: str) -> str | None:
    email = (raw or "").strip().lower()
    return email if len(email) <= 254 and EMAIL_RE.fullmatch(email) else None


def mask_email(email: str | None) -> str | None:
    # maria.santos@gmail.com -> ma***@gmail.com (RA 10173 data minimization)
    if not email or "@" not in email:
        return None
    name, domain = email.split("@", 1)
    return f"{name[:2]}***@{domain}"


def smtp_password(settings: dict) -> str | None:
    token = settings.get("smtp_password")
    return secretbox.decrypt(token, SECRET_PURPOSE) if token else None


def is_configured(settings: dict) -> bool:
    return bool(settings.get("smtp_host") and settings.get("smtp_username") and smtp_password(settings))


def _send_blocking(settings: dict, password: str, to: str, subject: str, body: str) -> None:
    msg = EmailMessage()
    msg["From"] = formataddr((settings.get("email_from_name") or "GinhawAI", settings["smtp_username"]))
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(body)
    host, port = settings["smtp_host"], int(settings.get("smtp_port") or 465)
    context = ssl.create_default_context()
    if port == 465:
        with smtplib.SMTP_SSL(host, port, timeout=15, context=context) as s:
            s.login(settings["smtp_username"], password)
            s.send_message(msg)
    else:
        with smtplib.SMTP(host, port, timeout=15) as s:
            s.starttls(context=context)
            s.login(settings["smtp_username"], password)
            s.send_message(msg)


async def send_email(settings: dict, to: str, subject: str, body: str) -> dict:
    """Returns {"status": "SENT"|"FAILED", "detail": ...}, same shape as send_sms."""
    if not settings.get("email_enabled", True):
        return {"status": "FAILED", "detail": "Email sending is paused by the administrator."}
    password = smtp_password(settings)
    if not (settings.get("smtp_host") and settings.get("smtp_username") and password):
        return {"status": "FAILED", "detail": "Email isn't set up yet."}
    try:
        await asyncio.to_thread(_send_blocking, settings, password, to, subject, body)
    except smtplib.SMTPAuthenticationError:
        return {"status": "FAILED", "detail": "The email account rejected the sign-in. Check the Gmail address and app password."}
    except smtplib.SMTPRecipientsRefused:
        return {"status": "FAILED", "detail": "That email address was refused."}
    except Exception as e:
        return {"status": "FAILED", "detail": f"Could not send the email ({type(e).__name__})."}
    return {"status": "SENT", "detail": "SENT"}


def build_checklist_email(programs: list[dict], offices: list[dict]) -> tuple[str, str]:
    """(subject, plain-text body) for a citizen's checklist. Holds no personal details."""
    lines = ["Here is your GinhawAI checklist.", ""]
    for p in programs:
        lines.append(p["program_name"])
        docs = p.get("documents", [])
        for d in docs:
            lines.append(f"  [ ] {d['document_name']}" + ("" if d.get("is_mandatory", True) else " (if available)"))
        if not docs:
            lines.append("  Ask the office which documents to bring.")
        lines.append("")
    if offices:
        lines.append("Where to go:")
        for o in offices[:3]:
            lines.append(f"  {o['office_name']}")
            for key in ("address", "operating_hours", "contact_number"):
                if o.get(key):
                    lines.append(f"    {o[key]}")
        lines.append("")
    lines += [
        "Final eligibility is decided by your LGU office.",
        "",
        "You received this because you typed this address into GinhawAI. We don't keep it.",
    ]
    return "Your GinhawAI document checklist", "\n".join(lines)
