"""Citizen accounts as seen by staff (2nd consultation, 2026-10-30; simplified 2026-10-31).

Privacy rule: staff never see who made an account or what a citizen answered, and staff
cannot delete or change a citizen's account. This module only offers:
  1) anonymous COUNTS for the dashboards (every staff role), and
  2) an automatic cleanup: an account with no sign-in for RETENTION_MONTHS is deleted
     together with everything saved under it (answers and past results, by cascade).
     This is the "storage limitation" rule of RA 10173: do not keep personal data longer
     than needed. It also removes accounts a citizen abandoned (for example after forgetting
     a password and making a new account).
Citizens can still delete their own account at any time from their own signed-in session
(routers/citizens.py), and the consent text tells them about the 12-month rule.
"""

import asyncio

from fastapi import APIRouter, Depends, Request

from app.auth import ANALYTICS_ROLES, require_roles

router = APIRouter()
analyst = require_roles(ANALYTICS_ROLES)

TZ = "Asia/Manila"
RETENTION_MONTHS = 12            # months without a sign-in before an account is deleted
WARNING_MONTHS = 1               # "deleting soon" in the counts = within this many months of the limit
PURGE_EVERY_SECONDS = 6 * 3600   # how often the cleanup job runs

# An account's last activity: its last sign-in, or its creation if it never signed in again.
LAST_ACTIVE = "COALESCE(last_login_at, created_at)"


@router.get("/api/analytics/citizen-accounts")
async def account_counts(request: Request, months: int = 12, current_admin: dict = Depends(analyst)):
    """Counts only: no row here can be traced to a person."""
    months = max(1, min(months, 36))
    async with request.app.state.db_pool.acquire() as conn:
        totals = await conn.fetchrow(
            "SELECT COUNT(*) AS total, "
            "COUNT(*) FILTER (WHERE google_sub IS NOT NULL) AS google, "
            "COUNT(*) FILTER (WHERE google_sub IS NULL) AS password, "
            f"COUNT(*) FILTER (WHERE date_trunc('month', created_at AT TIME ZONE '{TZ}') = date_trunc('month', now() AT TIME ZONE '{TZ}')) AS new_this_month, "
            "COUNT(*) FILTER (WHERE last_login_at >= now() - interval '30 days') AS active_30_days, "
            f"COUNT(*) FILTER (WHERE {LAST_ACTIVE} < now() - make_interval(months => $1::int - $2::int) AND {LAST_ACTIVE} >= now() - make_interval(months => $1::int)) AS deleting_soon "
            "FROM citizen_accounts;",
            RETENTION_MONTHS, WARNING_MONTHS,
        )
        monthly = await conn.fetch(
            f"SELECT to_char(created_at AT TIME ZONE '{TZ}', 'YYYY-MM') AS month, COUNT(*) AS count "
            f"FROM citizen_accounts WHERE created_at >= now() - make_interval(months => $1) GROUP BY 1 ORDER BY 1;",
            months,
        )
    return {**dict(totals), "retention_months": RETENTION_MONTHS, "monthly": [dict(r) for r in monthly]}


async def purge_inactive_accounts(pool) -> int:
    """Deletes accounts with no sign-in for RETENTION_MONTHS. Answers and results go with them (ON DELETE CASCADE)."""
    async with pool.acquire() as conn:
        result = await conn.execute(
            f"DELETE FROM citizen_accounts WHERE {LAST_ACTIVE} < now() - make_interval(months => $1);", RETENTION_MONTHS
        )
    return int(result.split()[-1])  # asyncpg returns "DELETE <count>"


async def purge_loop(app) -> None:
    """Runs at startup and then every few hours. Never lets an error stop the backend."""
    while True:
        try:
            n = await purge_inactive_accounts(app.state.db_pool)
            if n:
                print(f"[citizen accounts] deleted {n} account(s) with no sign-in for {RETENTION_MONTHS} months")
        except asyncio.CancelledError:
            raise
        except Exception as e:
            print(f"[citizen accounts] cleanup failed: {e}")
        await asyncio.sleep(PURGE_EVERY_SECONDS)
