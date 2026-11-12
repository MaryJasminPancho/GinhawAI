"""Application tracker, email reminders and "check again" nudges: signed-in citizens only.

Answer to the professor's "That's all?" (2nd consultation): after the results, a citizen
with an account can
  * track each program they may qualify for: not started -> papers ready -> applied -> approved,
    with an optional "valid until" date for IDs and benefits that must be renewed;
  * turn on email reminders (opt-in, RA 10173): a barangay visit date for one of their
    programs is near, an ID or benefit is about to expire, or it's time to check again;
  * see why they should check again (an old result, or someone turning 60).

Anonymous citizens don't get these; the results page invites them to sign up.
Nothing here is visible to staff.
"""

import asyncio
import re
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from app import mailer
from app.routers.citizens import current_citizen

router = APIRouter()

TZ = ZoneInfo("Asia/Manila")
STATUSES = ("not_started", "papers_ready", "applied", "approved")
RECHECK_DAYS = 90              # "check again" after this many days without a new check
SCHEDULE_DAYS_AHEAD = 3        # remind about a barangay visit this many days before it starts
RENEW_DAYS = (30, 7)           # remind this many days before "valid until"
REMINDER_EVERY_SECONDS = 3 * 3600
# IDs that never expire. (Solo Parent IDs last 1 year and PWD IDs 5 years; the citizen enters
# the date printed on their ID, and the dashboard says how long each lasts.)
NO_EXPIRY = re.compile(r"senior citizen id|osca", re.I)


class ApplicationIn(BaseModel):
    status: str = Field(pattern=r"^(not_started|papers_ready|applied|approved)$")
    valid_until: date | None = None


class RemindersIn(BaseModel):
    on: bool
    email: str | None = Field(default=None, max_length=254)


def today() -> date:
    return datetime.now(TZ).date()


def recheck_reasons(entities: dict, checked_on: datetime | None, now: date | None = None) -> list[str]:
    """Why the citizen should check again: "old" (no check for RECHECK_DAYS) and/or "age60"
    (the applicant was under 60 at the last check and has turned 60 since, so senior programs
    may now fit)."""
    if checked_on is None:
        return []
    now = now or today()
    checked = checked_on.astimezone(TZ).date()
    reasons = []
    if (now - checked).days >= RECHECK_DAYS:
        reasons.append("old")
    age = entities.get("age")
    if isinstance(age, (int, float)) and age < 60 and not entities.get("has_senior"):
        years = (now - checked).days // 365
        if age + years >= 60:
            reasons.append("age60")
    return reasons


async def _my_programs(conn, citizen_id) -> tuple[dict | None, list]:
    """(latest check, rows) for the programs the citizen may qualify for in their latest check,
    plus any program they are already tracking."""
    last = await conn.fetchrow(
        "SELECT assessment_id, entities, programs, created_at FROM citizen_assessments WHERE citizen_id = $1 ORDER BY created_at DESC LIMIT 1;",
        citizen_id,
    )
    names = [p["program_name"] for p in ((last and last["programs"]) or []) if p.get("status") in ("qualified", "partial")]
    rows = await conn.fetch(
        "SELECT p.program_id, p.program_name, COALESCE(a.status, 'not_started') AS status, a.valid_until "
        "FROM programs p LEFT JOIN citizen_applications a ON a.program_id = p.program_id AND a.citizen_id = $1 "
        "WHERE p.is_active AND (p.program_name = ANY($2::text[]) OR a.citizen_id IS NOT NULL) ORDER BY p.program_name;",
        citizen_id, names,
    )
    return (dict(last) if last else None), rows


@router.get("/api/citizen/tracker")
async def my_tracker(request: Request, me: dict = Depends(current_citizen)):
    cid = me["citizen_id"]
    async with request.app.state.db_pool.acquire() as conn:
        last, rows = await _my_programs(conn, cid)
        ids = [r["program_id"] for r in rows]
        answers = (last or {}).get("entities") or {}
        situation = [v for v in (answers.get("crisis_type"), answers.get("help_needed")) if v]
        # Papers ready per program: the same documents (and crisis rule) as the checklist.
        docs = await conn.fetch(
            "SELECT d.program_id, COUNT(*) AS total, COUNT(cd.doc_id) AS ready FROM document_requirements d "
            "LEFT JOIN citizen_documents cd ON cd.doc_id = d.doc_id AND cd.citizen_id = $1 "
            "WHERE d.program_id = ANY($2::uuid[]) AND (d.for_crisis IS NULL OR d.for_crisis = ANY($3::text[])) GROUP BY d.program_id;",
            cid, ids, situation,
        )
        schedules = await conn.fetch(
            "SELECT DISTINCT ON (s.program_id) s.program_id, s.start_date, s.end_date, o.office_name, o.address "
            "FROM barangay_schedules s JOIN lgu_offices o ON o.office_id = s.office_id "
            "WHERE s.program_id = ANY($1::uuid[]) AND s.end_date >= $2 ORDER BY s.program_id, s.start_date;",
            ids, today(),
        )
    counts = {r["program_id"]: r for r in docs}
    nxt = {r["program_id"]: r for r in schedules}
    programs = []
    for r in rows:
        c, s = counts.get(r["program_id"]), nxt.get(r["program_id"])
        programs.append({
            "program_id": str(r["program_id"]),
            "program_name": r["program_name"],
            "status": r["status"],
            "valid_until": r["valid_until"].isoformat() if r["valid_until"] else None,
            "ready": c["ready"] if c else 0,
            "total": c["total"] if c else 0,
            "next_schedule": {"start_date": s["start_date"].isoformat(), "end_date": s["end_date"].isoformat(),
                              "office_name": s["office_name"], "address": s["address"]} if s else None,
        })
    return {
        "programs": programs,
        "recheck": {
            "checked_on": last["created_at"].isoformat() if last else None,
            "days_since": (today() - last["created_at"].astimezone(TZ).date()).days if last else None,
            "reasons": recheck_reasons(answers, last["created_at"] if last else None),
        },
    }


@router.put("/api/citizen/tracker/{program_id}", status_code=204)
async def set_application(program_id: str, body: ApplicationIn, request: Request, me: dict = Depends(current_citizen)):
    # "Valid until" only means something once the ID or benefit is approved.
    valid_until = body.valid_until if body.status == "approved" else None
    async with request.app.state.db_pool.acquire() as conn:
        name = await conn.fetchval("SELECT program_name FROM programs WHERE program_id = $1::uuid AND is_active;", program_id)
        if name is None:
            raise HTTPException(status_code=404, detail="That program was not found.")
        if NO_EXPIRY.search(name):
            valid_until = None  # Senior Citizen IDs don't expire: no renewal date, no renewal reminder

        await conn.execute(
            "INSERT INTO citizen_applications (citizen_id, program_id, status, valid_until) VALUES ($1, $2::uuid, $3, $4) "
            "ON CONFLICT (citizen_id, program_id) DO UPDATE SET status = EXCLUDED.status, valid_until = EXCLUDED.valid_until, updated_at = now();",
            me["citizen_id"], program_id, body.status, valid_until,
        )


@router.get("/api/citizen/reminders")
async def my_reminders(request: Request, me: dict = Depends(current_citizen)):
    async with request.app.state.db_pool.acquire() as conn:
        row = await conn.fetchrow("SELECT reminders_on, reminder_email FROM citizen_accounts WHERE citizen_id = $1;", me["citizen_id"])
    return {
        "on": row["reminders_on"],
        "email": row["reminder_email"],
        "account_email": me["email"],  # Google accounts: offered as the default address
        "email_ready": mailer.is_configured(request.app.state.settings),
    }


@router.put("/api/citizen/reminders")
async def set_reminders(body: RemindersIn, request: Request, me: dict = Depends(current_citizen)):
    """Turning reminders on needs an email address and counts as consent to receive them.
    Turning them off also forgets the address (only kept while it is used)."""
    if body.on:
        email = mailer.normalize_email(body.email or "")
        if not email:
            raise HTTPException(status_code=422, detail="Please type a valid email address.")
        sql, args = "UPDATE citizen_accounts SET reminders_on = TRUE, reminder_email = $2, reminders_consent_at = now() WHERE citizen_id = $1;", (email,)
    else:
        email = None
        sql, args = "UPDATE citizen_accounts SET reminders_on = FALSE, reminder_email = NULL WHERE citizen_id = $1;", ()
    async with request.app.state.db_pool.acquire() as conn:
        await conn.execute(sql, me["citizen_id"], *args)
    return {"on": body.on, "email": email}


# ---------------------------------------------------------------------------
# Reminder emails
# ---------------------------------------------------------------------------
EMAIL_TEXT = {
    "subject": {"en": "GinhawAI reminder", "fil": "Paalala mula sa GinhawAI", "ceb": "Pahinumdom gikan sa GinhawAI"},
    "hello": {"en": "Hi {name},", "fil": "Kumusta, {name},", "ceb": "Kumusta, {name},"},
    "schedule": {
        "en": "{program}: there's a schedule at {office} from {start} to {end}. {address}",
        "fil": "{program}: may iskedyul sa {office} mula {start} hanggang {end}. {address}",
        "ceb": "{program}: naay iskedyul sa {office} gikan {start} hangtod {end}. {address}",
    },
    "renew": {
        "en": "{program}: valid until {date}. Renew it before then so it doesn't lapse.",
        "fil": "{program}: may bisa hanggang {date}. I-renew ito bago ang petsang iyon para hindi mapaso.",
        "ceb": "{program}: balido hangtod {date}. I-renew kini sa dili pa ang maong petsa aron dili ma-expire.",
    },
    "recheck": {
        "en": "It's been a while since your last check. If anything changed (work, income, a new baby, someone with a disability or turning 60), check again: you may qualify for more.",
        "fil": "Matagal na mula sa huli ninyong pagsusuri. Kung may nagbago (trabaho, kita, bagong sanggol, may kapansanan o nag-60), magsuri muli: baka may iba pa kayong makuha.",
        "ceb": "Dugay na sukad sa imong kataposang pagsusi. Kung naay nausab (trabaho, kita, bag-ong bata, naay kakulangan o nag-60), susiha pag-usab: basin naa pay laing makuha nimo.",
    },
    "age60": {
        "en": "You may have turned 60 since your last check. Check again: senior citizen programs may now fit.",
        "fil": "Maaaring nag-60 na kayo mula sa huli ninyong pagsusuri. Magsuri muli: baka pasok na kayo sa mga programa para sa senior citizen.",
        "ceb": "Basin nag-60 na ka sukad sa imong kataposang pagsusi. Susiha pag-usab: basin pasok na ka sa mga programa para sa senior citizen.",
    },
    "footer": {
        "en": "Open GinhawAI and log in to see your applications and checklist. To stop these emails, turn off reminders on your GinhawAI account page.",
        "fil": "Buksan ang GinhawAI at mag-log in para makita ang inyong mga aplikasyon at checklist. Para itigil ang mga email na ito, i-off ang paalala sa inyong account page sa GinhawAI.",
        "ceb": "Ablihi ang GinhawAI ug mag-log in aron makita ang imong mga aplikasyon ug checklist. Aron hunongon kini nga mga email, i-off ang pahinumdom sa imong account page sa GinhawAI.",
    },
}


def _fmt_date(d: date) -> str:
    return d.strftime("%b %d, %Y").replace(" 0", " ")


async def reminders_due(conn, citizen: dict, now: date) -> list[tuple[str, str, str]]:
    """(kind, ref, line) for every reminder this citizen should get now and hasn't been sent yet."""
    cid, lang = citizen["citizen_id"], citizen["language"] if citizen["language"] in ("en", "fil", "ceb") else "en"
    last, rows = await _my_programs(conn, cid)
    due: list[tuple[str, str, str]] = []

    waiting = [r["program_id"] for r in rows if r["status"] != "approved"]
    for s in await conn.fetch(
        "SELECT s.schedule_id, p.program_name, s.start_date, s.end_date, o.office_name, o.address "
        "FROM barangay_schedules s JOIN programs p ON p.program_id = s.program_id JOIN lgu_offices o ON o.office_id = s.office_id "
        "WHERE s.program_id = ANY($1::uuid[]) AND s.start_date BETWEEN $2 AND $3 ORDER BY s.start_date;",
        waiting, now, now + timedelta(days=SCHEDULE_DAYS_AHEAD),
    ):
        due.append(("schedule", str(s["schedule_id"]), EMAIL_TEXT["schedule"][lang].format(
            program=s["program_name"], office=s["office_name"], start=_fmt_date(s["start_date"]), end=_fmt_date(s["end_date"]), address=s["address"] or "").strip()))

    for r in rows:
        until = r["valid_until"]
        if r["status"] != "approved" or until is None or until < now:
            continue
        left = (until - now).days
        # 30 days before, then again 7 days before (each sent once).
        kind = "renew7" if left <= RENEW_DAYS[1] else "renew30" if left <= RENEW_DAYS[0] else None
        if kind:
            due.append((kind, f"{r['program_id']}:{until.isoformat()}", EMAIL_TEXT["renew"][lang].format(program=r["program_name"], date=_fmt_date(until))))

    if last:
        for reason in recheck_reasons(last["entities"] or {}, last["created_at"], now):
            kind = "recheck" if reason == "old" else "age60"
            due.append((kind, str(last["assessment_id"]), EMAIL_TEXT[kind][lang]))

    if not due:
        return []
    sent = {(r["kind"], r["ref"]) for r in await conn.fetch(
        "SELECT kind, ref FROM citizen_reminders_sent WHERE citizen_id = $1 AND (kind, ref) IN (SELECT * FROM unnest($2::text[], $3::text[]));",
        cid, [k for k, _, _ in due], [ref for _, ref, _ in due],
    )}
    return [d for d in due if (d[0], d[1]) not in sent]


def build_reminder_email(name: str, lang: str, lines: list[str]) -> tuple[str, str]:
    lang = lang if lang in ("en", "fil", "ceb") else "en"
    body = [EMAIL_TEXT["hello"][lang].format(name=name), ""] + [f"- {line}" for line in lines] + ["", EMAIL_TEXT["footer"][lang]]
    return EMAIL_TEXT["subject"][lang], "\n".join(body)


async def send_due_reminders(app) -> int:
    """One email per citizen with everything due, then remember what was sent. Returns emails sent."""
    settings = app.state.settings
    if not mailer.is_configured(settings) or not settings.get("email_enabled", True):
        return 0
    now, sent_count = today(), 0
    async with app.state.db_pool.acquire() as conn:
        citizens = await conn.fetch(
            "SELECT a.citizen_id, a.reminder_email, COALESCE(a.display_name, a.username, '') AS name, p.language "
            "FROM citizen_accounts a LEFT JOIN citizen_profiles p ON p.citizen_id = a.citizen_id "
            "WHERE a.reminders_on AND a.reminder_email IS NOT NULL;"
        )
        for c in citizens:
            due = await reminders_due(conn, dict(c), now)
            if not due:
                continue
            subject, body = build_reminder_email(c["name"] or "", c["language"] or "en", [line for _, _, line in due])
            result = await mailer.send_email(settings, c["reminder_email"], subject, body)
            if result["status"] != "SENT":
                print(f"[reminders] could not email a citizen: {result['detail']}")
                continue
            sent_count += 1
            await conn.executemany(
                "INSERT INTO citizen_reminders_sent (citizen_id, kind, ref) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING;",
                [(c["citizen_id"], kind, ref) for kind, ref, _ in due],
            )
    return sent_count


async def reminder_loop(app) -> None:
    """Runs at startup and then every few hours. Never lets an error stop the backend."""
    while True:
        try:
            n = await send_due_reminders(app)
            if n:
                print(f"[reminders] sent {n} reminder email(s)")
        except asyncio.CancelledError:
            raise
        except Exception as e:
            print(f"[reminders] failed: {e}")
        await asyncio.sleep(REMINDER_EVERY_SECONDS)
