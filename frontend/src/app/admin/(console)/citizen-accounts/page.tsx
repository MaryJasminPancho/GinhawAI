"use client";

import { useEffect, useState } from "react";
import { ColumnChart } from "@/components/admin/charts";
import { Card, EmptyState, ErrorText, fmtMonth, fmtNum, Loading, PageTitle, PrivacyChip, StatCard } from "@/components/admin/ui";
import { CitizenAccountCounts, getCitizenAccountCounts } from "@/lib/adminApi";

// Optional citizen accounts, counts only. Citizens can use GinhawAI without an account; staff
// never see who made one, what they answered, and cannot delete or change a citizen's account.
// A citizen deletes their own account whenever they want, and an account with no sign-in for
// `retention_months` is deleted automatically (RA 10173: don't keep personal data longer than needed).

export default function CitizenAccountsPage() {
  const [counts, setCounts] = useState<CitizenAccountCounts | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getCitizenAccountCounts(12)
      .then(setCounts)
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load citizen accounts"));
  }, []);

  return (
    <>
      <PageTitle
        title="Citizen Accounts"
        description="Citizens can use GinhawAI without an account. Those who make one can save their answers and come back later. This page shows only how many accounts there are: no names, no answers, and no way to open or delete an account."
        actions={<PrivacyChip />}
      />
      {error && <ErrorText>{error}</ErrorText>}
      {!counts && !error && <Loading />}
      {counts && (
        <>
          <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Citizen accounts" value={fmtNum(counts.total)} hint="All time" />
            <StatCard label="New this month" value={fmtNum(counts.new_this_month)} hint="Accounts created" />
            <StatCard label="Active in the last 30 days" value={fmtNum(counts.active_30_days)} hint="Signed in at least once" tone="gray" />
            <StatCard label="Sign-in method" value={`${fmtNum(counts.google)} Google`} hint={`${fmtNum(counts.password)} username & password`} tone="gray" />
          </div>

          <Card title="New accounts per month" subtitle="Last 12 months · counts only" className="mb-4">
            {counts.monthly.length === 0 ? (
              <EmptyState title="No accounts yet">Accounts will be counted here once citizens sign up.</EmptyState>
            ) : (
              <ColumnChart ariaLabel="New citizen accounts per month" data={counts.monthly.map((m) => ({ label: fmtMonth(m.month), value: m.count }))} />
            )}
          </Card>

          <Card title="How accounts are removed" subtitle="Staff cannot delete a citizen's account">
            <ul className="list-disc space-y-1.5 pl-5 text-[13px] text-gray-600 dark:text-gray-300">
              <li>A citizen can delete their own account at any time. Everything saved under it is removed.</li>
              <li>
                An account with <span className="font-semibold">no sign-in for {counts.retention_months} months</span> is deleted automatically, together with the saved answers and
                results. The consent text tells citizens about this.
              </li>
              <li>
                {counts.deleting_soon > 0
                  ? `${fmtNum(counts.deleting_soon)} account${counts.deleting_soon === 1 ? " is" : "s are"} within a month of that limit and will be deleted unless the citizen signs in.`
                  : "No account is close to that limit right now."}
              </li>
            </ul>
          </Card>
        </>
      )}
    </>
  );
}
