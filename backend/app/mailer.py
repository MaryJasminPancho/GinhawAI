"""One-way email, used by both sides: citizens can have their checklist emailed
(optional), and staff receive verification and password-reset codes.

Sent through an SMTP account set on the System Administrator's Email Gateway
page, normally a team Gmail account with a Google "app password" (free, about
500 emails a day). The app password is stored encrypted, never in a file.
"""

import asyncio
import html
import re
import smtplib
import ssl
from email.message import EmailMessage
from email.utils import formataddr, make_msgid
from pathlib import Path

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


EMBLEM = Path(__file__).parent / "assets" / "emblem.png"
LOGO_CID = "{logo_cid}"  # placeholder in the HTML, swapped for the real Content-ID when sending


def _send_blocking(settings: dict, password: str, to: str, subject: str, body: str, html_body: str | None = None) -> None:
    msg = EmailMessage()
    msg["From"] = formataddr((settings.get("email_from_name") or "GinhawAI", settings["smtp_username"]))
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(body)
    if html_body:
        # Formatted version (same look as the printed checklist); the plain text above stays
        # as the fallback for mail apps that can't show HTML. The logo travels inside the
        # email (inline image), so it shows without loading anything from the internet.
        cid = make_msgid(domain="ginhawai")
        msg.add_alternative(html_body.replace(LOGO_CID, cid[1:-1]), subtype="html")
        if EMBLEM.exists():
            msg.get_payload()[1].add_related(EMBLEM.read_bytes(), "image", "png", cid=cid, filename="ginhawai.png")
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


async def send_email(settings: dict, to: str, subject: str, body: str, html_body: str | None = None) -> dict:
    """Returns {"status": "SENT"|"FAILED", "detail": ...}, same shape as send_sms."""
    if not settings.get("email_enabled", True):
        return {"status": "FAILED", "detail": "Email sending is paused by the administrator."}
    password = smtp_password(settings)
    if not (settings.get("smtp_host") and settings.get("smtp_username") and password):
        return {"status": "FAILED", "detail": "Email isn't set up yet."}
    try:
        await asyncio.to_thread(_send_blocking, settings, password, to, subject, body, html_body)
    except smtplib.SMTPAuthenticationError:
        return {"status": "FAILED", "detail": "The email account rejected the sign-in. Check the Gmail address and app password."}
    except smtplib.SMTPRecipientsRefused:
        return {"status": "FAILED", "detail": "That email address was refused."}
    except Exception as e:
        return {"status": "FAILED", "detail": f"Could not send the email ({type(e).__name__})."}
    return {"status": "SENT", "detail": "SENT"}


# ---------------------------------------------------------------------------
# Checklist email: the same layout as the printed "Results and document checklist"
# (frontend/src/components/PrintDocument.tsx, ResultsPrint), in the language of the chat.
# Inline styles and tables only, because mail apps (Gmail especially) drop <style> blocks.
# ---------------------------------------------------------------------------
LABELS = {
    "subject": {"fil": "Ang iyong GinhawAI checklist ng dokumento", "ceb": "Ang imong GinhawAI checklist sa dokumento", "en": "Your GinhawAI document checklist"},
    "title": {"fil": "Resulta at checklist ng dokumento", "ceb": "Resulta ug checklist sa dokumento", "en": "Results and document checklist"},
    "date": {"fil": "Petsa", "ceb": "Petsa", "en": "Date"},
    "qualified": {"fil": "Kwalipikado", "ceb": "Kwalipikado", "en": "Qualified"},
    "partial": {"fil": "Maaaring kwalipikado", "ceb": "Mahimong kwalipikado", "en": "May qualify"},
    "not_qualified": {"fil": "Hindi kwalipikado", "ceb": "Dili kwalipikado", "en": "Not qualified"},
    "why_qualified": {"fil": "Bakit qualified ka?", "ceb": "Ngano qualified ka?", "en": "Why you qualify"},
    "why_partial": {"fil": "Bakit maaaring qualified ka?", "ceb": "Ngano mahimong qualified ka?", "en": "Why you may qualify"},
    "to_verify": {"fil": "Susuriin sa opisina", "ceb": "Susihon sa opisina", "en": "Checked at the office"},
    "documents": {"fil": "Mga dokumentong dadalhin", "ceb": "Mga dokumento nga dad-on", "en": "Documents to bring"},
    "required": {"fil": "Kailangan", "ceb": "Kinahanglan", "en": "Required"},
    "optional": {"fil": "Opsyonal", "ceb": "Opsyonal", "en": "Optional"},
    "no_docs": {"fil": "Itanong sa opisina kung anong dokumento ang dadalhin.", "ceb": "Pangutan-a ang opisina kung unsang dokumento ang dad-on.", "en": "Ask the office which documents to bring."},
    "schedules": {"fil": "Mga iskedyul", "ceb": "Mga iskedyul", "en": "Schedules"},
    "offices": {"fil": "Saan pupunta", "ceb": "Asa moadto", "en": "Where to go"},
    "others": {"fil": "Iba pang programa na nasuri", "ceb": "Ubang programa nga gisusi", "en": "Other programs we checked"},
    "urgent": {"fil": "Kailangan ng tulong ngayon?", "ceb": "Kinahanglan og tabang karon?", "en": "Need help right now?"},
    "disclaimer": {
        "fil": "Ang huling desisyon sa pagiging kwalipikado ay mula sa opisina ng LGU.",
        "ceb": "Ang katapusang desisyon kung kwalipikado ba gikan sa opisina sa LGU.",
        "en": "Final eligibility is decided by your LGU office.",
    },
    "why_received": {
        "fil": "Natanggap mo ito dahil inilagay mo ang address na ito sa GinhawAI. Hindi namin ito itinatago.",
        "ceb": "Nadawat nimo kini kay gi-type nimo kini nga address sa GinhawAI. Dili namo kini gitipigan.",
        "en": "You received this because you typed this address into GinhawAI. We don't keep it.",
    },
}

MONTHS = {
    "en": ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
    "fil": ["Enero", "Pebrero", "Marso", "Abril", "Mayo", "Hunyo", "Hulyo", "Agosto", "Setyembre", "Oktubre", "Nobyembre", "Disyembre"],
}

BRAND, BRAND_DARK = "#0a7049", "#0c583b"
STATUS_COLOR = {"qualified": "#166534", "partial": "#92400e", "not_qualified": "#991b1b"}
STATUS_BORDER = {"qualified": "#15803d", "partial": "#d97706", "not_qualified": "#b91c1c"}
FONT = "Arial, Helvetica, sans-serif"
URL_RE = re.compile(r"((?:https?://)?(?:www\.)?[a-z0-9][a-z0-9\-]*(?:\.[a-z0-9\-]+)*\.(?:gov\.ph|com\.ph|org\.ph|ph|com|org|net)(?:/[^\s)<]*)?)", re.I)


def _l(key: str, lang: str) -> str:
    return LABELS[key].get(lang) or LABELS[key]["en"]


def _date(iso: str | None, lang: str) -> str | None:
    if not iso:
        return None
    try:
        y, m, d = (int(x) for x in str(iso)[:10].split("-"))
    except ValueError:
        return str(iso)
    return f"{MONTHS['en' if lang == 'en' else 'fil'][m - 1]} {d}, {y}"


def _e(text) -> str:
    return html.escape(str(text or ""))


def _rich(text: str | None) -> str:
    """Escaped text with line breaks kept and web addresses as blue links (like LinkText)."""
    out = []
    for part in URL_RE.split(str(text or "")):
        if URL_RE.fullmatch(part):
            href = part if part.lower().startswith("http") else f"https://{part}"
            out.append(f'<a href="{_e(href)}" style="color:#1d4ed8;text-decoration:underline">{_e(part)}</a>')
        else:
            out.append(_e(part))
    return "".join(out).replace("\n", "<br>")


def _heading(text: str) -> str:
    return (f'<p style="margin:14px 0 6px;font-size:12px;font-weight:bold;text-transform:uppercase;'
            f'letter-spacing:0.5px;color:{BRAND_DARK}">{_e(text)}</p>')


def _box(checked: bool) -> str:
    return (f'<td valign="top" style="width:22px;padding:2px 0"><div style="width:14px;height:14px;border:1px solid #374151;'
            f'font-size:11px;line-height:14px;text-align:center;color:#111827">{"&#10003;" if checked else "&nbsp;"}</div></td>')


def _program_html(p: dict, lang: str, have: set[str], first: bool) -> str:
    status = p.get("status", "partial")
    top = "" if first else "border-top:1px solid #d1d5db;padding-top:18px;margin-top:18px;"
    parts = [f'<div style="{top}">',
             '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>'
             f'<td style="font-size:18px;font-weight:bold;color:#111827">{_e(p["program_name"])}</td>'
             f'<td align="right" valign="top" style="white-space:nowrap"><span style="display:inline-block;border:1px solid {STATUS_BORDER.get(status)};'
             f'border-radius:4px;padding:2px 8px;font-size:12px;font-weight:bold;color:{STATUS_COLOR.get(status)}">{_e(_l(status, lang))}</span></td>'
             '</tr></table>']
    if p.get("agency"):
        parts.append(f'<p style="margin:2px 0 0;font-size:12px;color:#6b7280">{_e(p["agency"])}</p>')
    if p.get("summary"):
        parts.append(f'<p style="margin:8px 0 0">{_rich(p["summary"])}</p>')

    criteria = p.get("criteria") or []
    if criteria:
        parts.append(_heading(_l("why_qualified" if status == "qualified" else "why_partial", lang)))
        rows = []
        for c in criteria:
            mark = {"pass": "&#10003;", "fail": "&#10007;"}.get(c.get("status"), "?")
            expl = _l("to_verify", lang) if c.get("status") == "unknown" else c.get("explanation")
            note = f'<br><span style="font-size:12px;color:#4b5563">{_rich(c["note"])}</span>' if c.get("note") else ""
            rows.append(f'<tr><td valign="top" style="width:20px;font-weight:bold;padding:2px 0">{mark}</td>'
                        f'<td style="padding:2px 0"><b>{_e(c.get("label"))}</b><br>{_rich(expl)}{note}</td></tr>')
        parts.append('<table role="presentation" width="100%" cellpadding="0" cellspacing="0">' + "".join(rows) + "</table>")

    docs = p.get("documents") or []
    parts.append(_heading(_l("documents", lang)))
    if docs:
        rows = []
        for d in docs:
            tag = _l("required" if d.get("is_mandatory", True) else "optional", lang)
            notes = f'<br><span style="font-size:13px;color:#374151">{_rich(d["notes"])}</span>' if d.get("notes") else ""
            rows.append(f'<tr>{_box(str(d.get("doc_id")) in have)}<td style="padding:2px 0 6px"><b>{_e(d["document_name"])}</b>'
                        f' <span style="font-size:12px;color:#6b7280">({_e(tag)})</span>{notes}</td></tr>')
        parts.append('<table role="presentation" width="100%" cellpadding="0" cellspacing="0">' + "".join(rows) + "</table>")
    else:
        parts.append(f'<p style="margin:0">{_e(_l("no_docs", lang))}</p>')

    scheds = p.get("schedules") or []
    if scheds:
        parts.append(_heading(_l("schedules", lang)))
        for s in scheds:
            addr = f'<span style="color:#4b5563">, {_e(s["address"])}</span>' if s.get("address") else ""
            parts.append(f'<p style="margin:0 0 3px"><b>{_e(_date(s.get("start_date"), lang))} – {_e(_date(s.get("end_date"), lang))}</b>'
                         f': {_e(s.get("office_name"))}{addr}</p>')
    parts.append("</div>")
    return "".join(parts)


def build_checklist_email(programs: list[dict], offices: list[dict], lang: str = "en", *, barangay: str | None = None,
                          assessed_on: str | None = None, urgent: list[dict] | None = None,
                          others: list[str] | None = None, have: set[str] | None = None) -> tuple[str, str, str]:
    """(subject, plain-text body, HTML body) for a citizen's checklist. Holds no personal details
    (the barangay and the answers' results only, no name, no address)."""
    lang = lang if lang in ("fil", "ceb", "en") else "en"
    have = have or set()
    urgent = urgent or []
    date = _date(assessed_on, lang)

    # --- plain text (fallback) ---
    lines = [f"GinhawAI: {_l('title', lang)}"]
    if date:
        lines.append(f"{_l('date', lang)}: {date}")
    if barangay:
        lines.append(f"Barangay: {barangay}")
    lines.append("")
    if urgent:
        lines.append(_l("urgent", lang))
        for c in urgent:
            lines.append(f"  {c['name']}" + (f" · {c['phone']}" if c.get("phone") else "") + f" — {c.get('what', '')}")
        lines.append("")
    for p in programs:
        lines.append(f"{p['program_name']} ({_l(p.get('status', 'partial'), lang)})")
        docs = p.get("documents", [])
        for d in docs:
            box = "[x]" if str(d.get("doc_id")) in have else "[ ]"
            lines.append(f"  {box} {d['document_name']} ({_l('required' if d.get('is_mandatory', True) else 'optional', lang)})")
        if not docs:
            lines.append(f"  {_l('no_docs', lang)}")
        lines.append("")
    if offices:
        lines.append(f"{_l('offices', lang)}:")
        for o in offices[:6]:
            lines.append(f"  {o['office_name']}")
            for key in ("address", "operating_hours", "contact_number"):
                if o.get(key):
                    lines.append(f"    {o[key]}")
        lines.append("")
    if others:
        lines += [f"{_l('others', lang)}: {', '.join(others)}", ""]
    lines += [_l("disclaimer", lang), "", _l("why_received", lang)]

    # --- HTML (same layout as the printed checklist) ---
    meta = []
    if date:
        meta.append(f'{_e(_l("date", lang))}: <b style="color:#111827">{_e(date)}</b>')
    if barangay:
        meta.append(f'Barangay: <b style="color:#111827">{_e(barangay)}</b>')
    body = []
    if urgent:
        items = "".join(
            f'<p style="margin:0 0 4px"><b>{_e(c["name"])}</b>{" · " + _e(c["phone"]) if c.get("phone") else ""}'
            f'<span style="color:#4b5563"> — {_e(c.get("what"))}</span>'
            + (f'<br><span style="font-size:12px;color:#6b7280">{_e(c["address"])}</span>' if c.get("address") else "") + "</p>"
            for c in urgent)
        body.append(f'<div style="border:1px solid #b91c1c;border-radius:4px;padding:10px 12px;margin-bottom:18px">'
                    f'{_heading(_l("urgent", lang)).replace("margin:14px 0 6px", "margin:0 0 6px")}{items}</div>')
    for i, p in enumerate(programs):
        body.append(_program_html(p, lang, have, i == 0))
    if offices:
        cells = []
        for o in offices[:6]:
            extra = " · ".join(_e(o[k]) for k in ("operating_hours", "contact_number") if o.get(k))
            cells.append(f'<td valign="top" width="50%" style="padding:0 12px 10px 0"><b>{_e(o["office_name"])}</b>'
                         + (f'<br><span style="font-size:13px">{_e(o["address"])}</span>' if o.get("address") else "")
                         + (f'<br><span style="font-size:12px;color:#4b5563">{extra}</span>' if extra else "") + "</td>")
        rows = "".join("<tr>" + "".join(cells[i:i + 2]) + ("<td></td>" if len(cells[i:i + 2]) == 1 else "") + "</tr>"
                       for i in range(0, len(cells), 2))
        body.append(f'<div style="border-top:1px solid #d1d5db;margin-top:18px;padding-top:4px">{_heading(_l("offices", lang))}'
                    f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0">{rows}</table></div>')
    if others:
        body.append(f'<p style="margin:14px 0 0;font-size:12px;color:#6b7280">{_e(_l("others", lang))}: {_e(", ".join(others))}</p>')

    html_body = f"""<!doctype html>
<html lang="{'en' if lang == 'en' else 'fil'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"></head>
<body style="margin:0;padding:0;background:#f3f4f6">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6"><tr><td align="center" style="padding:16px 8px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#ffffff;border:1px solid #e5e7eb;border-radius:8px">
<tr><td style="padding:20px 22px;font-family:{FONT};font-size:14px;line-height:1.45;color:#111827">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-bottom:2px solid {BRAND};padding-bottom:10px"><tr>
<td valign="middle" style="width:60px;padding-bottom:10px"><img src="cid:{LOGO_CID}" alt="GinhawAI" width="52" height="52" style="display:block;width:52px;height:52px"></td>
<td valign="middle" style="padding-bottom:10px"><p style="margin:0;font-size:11px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;color:{BRAND}">GinhawAI</p>
<p style="margin:0;font-size:21px;font-weight:bold;line-height:1.2;color:#111827">{_e(_l("title", lang))}</p>
<p style="margin:4px 0 0;font-size:12px;color:#4b5563">{" &nbsp;·&nbsp; ".join(meta)}</p></td>
</tr></table>
<div style="margin-top:16px">{"".join(body)}</div>
<p style="margin:22px 0 0;border-top:1px solid #d1d5db;padding-top:8px;font-size:12px;color:#6b7280">{_e(_l("disclaimer", lang))}</p>
<p style="margin:6px 0 0;font-size:11px;color:#9ca3af">{_e(_l("why_received", lang))}</p>
</td></tr></table>
</td></tr></table>
</body></html>"""
    return _l("subject", lang), "\n".join(lines), html_body
