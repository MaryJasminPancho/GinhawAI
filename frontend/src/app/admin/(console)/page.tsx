"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAdmin } from "@/components/admin/AdminShell";
import { BarList, ColumnChart, Sparkline, TierStack } from "@/components/admin/charts";
import { Badge, Card, fmtDate, fmtDateTime, fmtMonth, fmtNum, fmtPct, Loading, PageTitle, PrivacyChip, StatCard } from "@/components/admin/ui";
import {
  AdminProgram,
  AuditLog,
  Barangay,
  DemandCell,
  Feedback,
  getAuditLogs,
  getDemandLogs,
  getFeedback,
  getRatings,
  getSmsStats,
  getSystemHealth,
  getValidationCases,
  LIVE,
  listBarangays,
  listOffices,
  listPrograms,
  listSchedules,
  Office,
  Rating,
  Schedule,
  ServiceStatus,
  SmsMonth,
} from "@/lib/adminApi";
import { byBarangay, byMonth, byTier, filterDemand, lastMonthChange, monthsFor, sum } from "@/lib/adminAnalytics";

const TODAY = new Date().toISOString().slice(0, 10);

type Data = {
  programs: AdminProgram[];
  schedules: Schedule[];
  offices: Office[];
  audit: AuditLog[];
  demand: DemandCell[];
  barangays: Barangay[];
  sms: SmsMonth[];
  feedback: Feedback[];
  cases: number;
  ratings: Rating[];
  health: ServiceStatus[] | null;
  loadedAt: number;
};

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Magandang umaga" : h < 18 ? "Magandang hapon" : "Magandang gabii";
}

export default function DashboardPage() {
  const { session, group } = useAdmin();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      listPrograms(),
      listSchedules(),
      listOffices(),
      getAuditLogs(),
      getDemandLogs(),
      listBarangays(),
      getSmsStats(),
      getFeedback(),
      getValidationCases(),
      getRatings(),
      group === "sysadmin" ? getSystemHealth() : Promise.resolve(null),
    ])
      .then(([programs, schedules, offices, audit, demand, barangays, sms, feedback, cases, ratings, health]) =>
        setData({ programs, schedules, offices, audit, demand, barangays, sms: sms.months, feedback, cases: cases.length, ratings, health, loadedAt: Date.now() })
      )
      .catch((e) => setError(e.message));
  }, [group]);

  const intro =
    group === "executive"
      ? "Aggregate, anonymized welfare demand across Cebu City barangays."
      : group === "sysadmin"
        ? "Platform health, access and the welfare knowledge base at a glance."
        : "Keep program rules, aid schedules and office details up to date for citizens.";

  return (
    <>
      <PageTitle title={`${greeting()}, ${session.username}`} description={intro} actions={group !== "welfare" ? <PrivacyChip /> : undefined} />
      {error && <p className="text-sm text-red-600 dark:text-red-400">Could not load the dashboard. ({error})</p>}
      {!data && !error && <Loading />}
      {data && (group === "executive" ? <ExecutiveView d={data} /> : <OperationsView d={data} showHealth={group === "sysadmin"} showAnalytics={group === "sysadmin"} />)}
    </>
  );
}

function AnalyticsBlock({ d }: { d: Data }) {
  const months = monthsFor("6m");
  const cells = filterDemand(d.demand, months);
  const trend = byMonth(cells, months);
  const tiers = byTier(cells);
  const thisMonth = trend[trend.length - 1].value;
  const change = lastMonthChange(trend);
  const names = Object.fromEntries(d.barangays.map((b) => [b.barangay_code, b.barangay_name]));
  const top = byBarangay(cells)
    .sort((a, b) => b.high - a.high)
    .slice(0, 5)
    .map((b) => ({ label: names[b.code] ?? b.code, value: b.high, sub: `of ${fmtNum(b.total)}` }));
  const smsTotal = d.sms.slice(-1)[0];
  const smsRate = smsTotal.delivered / (smsTotal.delivered + smsTotal.failed);
  const sus = d.feedback.slice(0, 60).reduce((a, f) => a + f.sus_score, 0) / Math.min(60, d.feedback.length);

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={`Assessments · ${fmtMonth(months[months.length - 1])}`} value={fmtNum(thisMonth)} hint={`${change >= 0 ? "▲" : "▼"} ${fmtPct(Math.abs(change))} vs last month`} />
        <StatCard label="High-risk households (6 mo)" value={fmtPct(tiers.high / Math.max(1, sum(cells)), 0)} hint={`${fmtNum(tiers.high)} flagged high urgency`} tone="red" />
        <StatCard label="SMS delivery rate" value={fmtPct(smsRate)} hint={`${fmtNum(smsTotal.delivered)} delivered this month`} tone={smsRate >= 0.95 ? "brand" : "amber"} />
        <StatCard label="Avg. SUS score" value={sus.toFixed(1)} hint={`From the last ${Math.min(60, d.feedback.length)} citizen sessions`} tone={sus >= 68 ? "brand" : "amber"} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card title="Assessment demand" subtitle="Completed assessments per month · last 6 months" className="xl:col-span-2" actions={<Link href="/admin/analytics" className="text-xs font-semibold text-brand-700 hover:underline dark:text-brand-300">Open heatmap →</Link>}>
          <ColumnChart ariaLabel="Assessments per month" data={trend.map((t) => ({ label: fmtMonth(t.month), value: t.value }))} />
        </Card>
        <Card title="Vulnerability mix" subtitle="Share of households by risk tier">
          <TierStack {...tiers} />
          <div className="mt-6">
            <p className="mb-3 text-xs font-semibold text-gray-500 dark:text-gray-400">Most high-risk households</p>
            <BarList data={top} />
          </div>
        </Card>
      </div>
    </>
  );
}

function ExecutiveView({ d }: { d: Data }) {
  return (
    <div className="space-y-4">
      <AnalyticsBlock d={d} />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card title="Policy intelligence reports" subtitle="Six export-ready reports for planning">
          <ul className="grid grid-cols-1 gap-2 text-[13px] sm:grid-cols-2">
            {["Aid Demand Trend", "Eligibility Gap", "Vulnerability Heatmap Density", "Document Deficiency", "SMS Delivery Success", "Aggregate User Satisfaction"].map((r) => (
              <li key={r} className="flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2 text-gray-700 dark:bg-white/[0.04] dark:text-gray-300">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
                {r}
              </li>
            ))}
          </ul>
          <Link href="/admin/reports" className="mt-4 inline-block text-xs font-semibold text-brand-700 hover:underline dark:text-brand-300">
            Go to reports →
          </Link>
        </Card>
        <Card title="SMS checklists sent" subtitle="Delivered per month · last 12 months">
          <Sparkline values={d.sms.map((m) => m.delivered)} className="h-16" />
          <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
            {fmtNum(d.sms.reduce((a, m) => a + m.delivered, 0))} document checklists delivered to citizens&apos; phones this year.
          </p>
        </Card>
      </div>
    </div>
  );
}

function OperationsView({ d, showHealth, showAnalytics }: { d: Data; showHealth: boolean; showAnalytics: boolean }) {
  const { session } = useAdmin();
  const active = d.programs.filter((p) => p.is_active).length;
  const upcoming = d.schedules.filter((s) => s.end_date >= TODAY).sort((a, b) => a.start_date.localeCompare(b.start_date));
  const ongoing = upcoming.filter((s) => s.start_date <= TODAY).length;
  const myRatings = d.ratings.filter((r) => r.rater === session.username).length;
  const weekAgo = new Date(d.loadedAt - 7 * 864e5).toISOString();
  const changes = d.audit.filter((a) => a.timestamp >= weekAgo && ["INSERT", "UPDATE", "DELETE"].includes(a.action_type)).length;
  const flagged = d.audit.filter((a) => a.flagged).length;
  const programName = (id: string) => d.programs.find((p) => p.program_id === id)?.program_name ?? "Program";
  const officeName = (id: string) => d.offices.find((o) => o.office_id === id)?.office_name ?? "Office";

  return (
    <div className="space-y-4">
      {showHealth && d.health && (
        <Card title="Service status" actions={<Link href="/admin/system" className="text-xs font-semibold text-brand-700 hover:underline dark:text-brand-300">Details →</Link>}>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {d.health.map((s) => (
              <div key={s.name} className="flex items-center justify-between gap-2 rounded-xl bg-gray-50 px-3 py-2 dark:bg-white/[0.04]">
                <span className="truncate text-[13px] text-gray-700 dark:text-gray-300">{s.name}</span>
                <Badge tone={s.status === "up" ? "green" : s.status === "degraded" ? "amber" : "red"} dot>
                  {s.status === "up" ? "Up" : s.status === "degraded" ? "Degraded" : "Down"}
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active programs" value={active} hint={`${d.programs.length - active} inactive · ${d.programs.length} total`} />
        <StatCard label="Aid schedules" value={upcoming.length} hint={`${ongoing} running now · ${upcoming.length - ongoing} upcoming`} />
        <StatCard label="Blind validation" value={`${myRatings}/${d.cases}`} hint="Cases you've rated" tone={myRatings >= d.cases ? "brand" : "amber"} />
        <StatCard label="Changes this week" value={changes} hint={flagged ? `${flagged} flagged access events` : "No flagged access events"} tone={flagged ? "red" : "gray"} />
      </div>

      {showAnalytics && <AnalyticsBlock d={d} />}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <Card title="Upcoming barangay aid schedules" className="xl:col-span-3" actions={<Link href="/admin/schedules" className="text-xs font-semibold text-brand-700 hover:underline dark:text-brand-300">Manage →</Link>}>
          {upcoming.length === 0 ? (
            <p className="text-sm text-gray-500">No upcoming schedules.</p>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-white/5">
              {upcoming.slice(0, 5).map((s) => (
                <li key={s.schedule_id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="flex w-12 shrink-0 flex-col items-center rounded-xl bg-brand-50 py-1.5 text-brand-800 dark:bg-brand-500/10 dark:text-brand-300">
                    <span className="text-[10px] font-semibold uppercase">{new Date(s.start_date).toLocaleDateString("en-PH", { month: "short" })}</span>
                    <span className="text-lg font-bold leading-none">{new Date(s.start_date).getDate()}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-gray-900 dark:text-white">{programName(s.program_id)}</p>
                    <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                      {officeName(s.office_id)} · until {fmtDate(s.end_date)}
                    </p>
                  </div>
                  {s.start_date <= TODAY && <Badge tone="green" dot>Ongoing</Badge>}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Recent activity" className="xl:col-span-2" actions={<Link href="/admin/audit-logs" className="text-xs font-semibold text-brand-700 hover:underline dark:text-brand-300">Audit trail →</Link>}>
          <ul className="space-y-3">
            {d.audit.slice(0, 6).map((a) => (
              <li key={a.audit_id} className="flex gap-2.5 text-[13px]">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${a.flagged ? "bg-red-500" : a.action_type === "DELETE" ? "bg-amber-500" : "bg-brand-500"}`} />
                <div className="min-w-0">
                  <p className="truncate text-gray-700 dark:text-gray-300">
                    <span className="font-semibold text-gray-900 dark:text-white">{a.username}</span> · {a.action_type.toLowerCase().replace("_", " ")} <span className="font-mono text-xs">{a.target_table}</span>
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">{fmtDateTime(a.timestamp)}</p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {!LIVE.schedules && <p className="text-xs text-gray-400 dark:text-gray-500">Schedules, activity and analytics above use sample data until their endpoints are built.</p>}
    </div>
  );
}
