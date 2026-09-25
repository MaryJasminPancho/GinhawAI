"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAdmin } from "@/components/admin/AdminShell";
import { BarList, ColumnChart, TierStack } from "@/components/admin/charts";
import { Badge, Card, EmptyState, ErrorText, fmtDate, fmtDateTime, fmtMonth, fmtNum, fmtPct, Loading, PageTitle, PrivacyChip, StatCard } from "@/components/admin/ui";
import {
  AdminProgram,
  AuditLog,
  Barangay,
  DemandData,
  Feedback,
  getAuditLogs,
  getDemand,
  getFeedback,
  getRatings,
  getSmsStats,
  getSystemHealth,
  getValidationCases,
  listBarangays,
  listOffices,
  listPrograms,
  listSchedules,
  Office,
  Rating,
  RoleGroup,
  Schedule,
  ServiceStatus,
  SmsMonth,
} from "@/lib/adminApi";
import { byBarangay, byMonth, byTier, filterDemand, lastMonthChange, monthsFor, sum, UNTAGGED } from "@/lib/adminAnalytics";

type Data = {
  programs: AdminProgram[];
  barangays: Barangay[];
  demand: DemandData | null;
  sms: SmsMonth[];
  feedback: Feedback[];
  schedules: Schedule[];
  offices: Office[];
  audit: AuditLog[];
  cases: number;
  ratings: Rating[];
  health: ServiceStatus[] | null;
  loadedAt: number;
};

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Magandang umaga" : h < 18 ? "Magandang hapon" : "Magandang gabii";
}

async function load(group: RoleGroup): Promise<Data> {
  const ops = group !== "executive";
  const [programs, barangays, demand, sms, feedback, schedules, offices, audit, cases, ratings, health] = await Promise.all([
    listPrograms(),
    listBarangays(),
    getDemand(12),
    getSmsStats(12),
    getFeedback(12),
    ops ? listSchedules() : Promise.resolve([]),
    ops ? listOffices() : Promise.resolve([]),
    ops ? getAuditLogs() : Promise.resolve([]),
    ops ? getValidationCases().then((c) => c.length) : Promise.resolve(0),
    ops ? getRatings() : Promise.resolve([]),
    group === "sysadmin" ? getSystemHealth() : Promise.resolve(null),
  ]);
  return { programs, barangays, demand, sms: sms.months, feedback, schedules, offices, audit, cases, ratings, health, loadedAt: Date.now() };
}

export default function DashboardPage() {
  const { session, group } = useAdmin();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    load(group).then(setData).catch((e) => setError(e.message));
  }, [group]);

  const intro =
    group === "executive"
      ? "Aggregate, anonymized welfare demand across barangays."
      : group === "sysadmin"
        ? "Platform health, access and the welfare knowledge base at a glance."
        : "Keep program rules, aid schedules and office details up to date for citizens.";

  return (
    <>
      <PageTitle title={`${greeting()}, ${session.username}`} description={intro} actions={group !== "welfare" ? <PrivacyChip /> : undefined} />
      {error && <ErrorText>Could not load the dashboard. {error}</ErrorText>}
      {!data && !error && <Loading />}
      {data && (group === "executive" ? <ExecutiveView d={data} /> : <OperationsView d={data} group={group} />)}
    </>
  );
}

function AnalyticsBlock({ d }: { d: Data }) {
  if (!d.demand) return null;
  const months = monthsFor(d.demand.months, "6m");
  const rows = filterDemand(d.demand, months);
  const total = sum(rows);
  const trend = byMonth(rows, months);
  const tiers = byTier(rows);
  const change = lastMonthChange(trend);
  const names = Object.fromEntries(d.barangays.map((b) => [b.barangay_code, b.barangay_name]));
  const top = byBarangay(rows)
    .filter((b) => b.high > 0)
    .sort((a, b) => b.high - a.high)
    .slice(0, 5)
    .map((b) => ({ label: b.code === UNTAGGED ? "Unlisted barangay" : names[b.code] ?? b.code, value: b.high, sub: `of ${fmtNum(b.total)}` }));
  const smsMonth = d.sms[d.sms.length - 1];
  const smsTotal = smsMonth ? smsMonth.sent + smsMonth.failed : 0;
  const recentFb = d.feedback.slice(0, 60);
  const sus = recentFb.length ? recentFb.reduce((a, f) => a + f.sus_score, 0) / recentFb.length : null;

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={`Assessments · ${fmtMonth(months[months.length - 1])}`} value={fmtNum(trend[trend.length - 1].value)} hint={trend.length > 1 && trend[trend.length - 2].value > 0 ? `${change >= 0 ? "▲" : "▼"} ${fmtPct(Math.abs(change))} vs last month` : "First month of data"} />
        <StatCard label="High-risk households (6 mo)" value={total ? fmtPct(tiers.high / total, 0) : "—"} hint={`${fmtNum(tiers.high)} of ${fmtNum(total)} assessments`} tone="red" />
        <StatCard label="SMS sent this month" value={smsTotal ? fmtPct(smsMonth.sent / smsTotal) : "—"} hint={smsTotal ? `${fmtNum(smsMonth.sent)} of ${fmtNum(smsTotal)} accepted by gateway` : "No SMS sent yet"} tone={!smsTotal || smsMonth.sent / smsTotal >= 0.95 ? "brand" : "amber"} />
        <StatCard label="Avg. SUS score" value={sus === null ? "—" : sus.toFixed(1)} hint={sus === null ? "No feedback yet" : `From the last ${recentFb.length} citizen responses`} tone={sus === null || sus >= 68 ? "brand" : "amber"} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card title="Assessment demand" subtitle="Completed assessments per month · last 6 months" className="xl:col-span-2" actions={<Link href="/admin/analytics" className="text-xs font-semibold text-brand-700 hover:underline dark:text-brand-300">Open heatmap →</Link>}>
          {total === 0 ? <EmptyState title="No assessments yet">Completed citizen assessments will appear here.</EmptyState> : <ColumnChart ariaLabel="Assessments per month" data={trend.map((t) => ({ label: fmtMonth(t.month), value: t.value }))} />}
        </Card>
        <Card title="Vulnerability mix" subtitle="Share of households by risk tier">
          <TierStack {...tiers} />
          <div className="mt-6">
            <p className="mb-3 text-xs font-semibold text-gray-500 dark:text-gray-400">Most high-risk households</p>
            {top.length ? <BarList data={top} /> : <p className="text-xs text-gray-400">None recorded yet.</p>}
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
      <Card title="Policy intelligence reports" subtitle="Six export-ready reports for planning">
        <ul className="grid grid-cols-1 gap-2 text-[13px] sm:grid-cols-2 lg:grid-cols-3">
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
    </div>
  );
}

function OperationsView({ d, group }: { d: Data; group: RoleGroup }) {
  const { session } = useAdmin();
  const today = new Date(d.loadedAt).toISOString().slice(0, 10);
  const active = d.programs.filter((p) => p.is_active).length;
  const upcoming = d.schedules.filter((s) => s.end_date >= today).sort((a, b) => a.start_date.localeCompare(b.start_date));
  const ongoing = upcoming.filter((s) => s.start_date <= today).length;
  const myRatings = d.ratings.filter((r) => r.rater === session.username).length;
  const weekAgo = new Date(d.loadedAt - 7 * 864e5).toISOString();
  const changes = d.audit.filter((a) => a.timestamp >= weekAgo && ["INSERT", "UPDATE", "DELETE"].includes(a.action_type)).length;
  const flagged = d.audit.filter((a) => a.flagged && a.timestamp >= weekAgo).length;
  const programName = (id: string) => d.programs.find((p) => p.program_id === id)?.program_name ?? "Program";
  const officeName = (id: string) => d.offices.find((o) => o.office_id === id)?.office_name ?? "Office";

  return (
    <div className="space-y-4">
      {group === "sysadmin" && d.health && (
        <Card title="Service status" actions={<Link href="/admin/system" className="text-xs font-semibold text-brand-700 hover:underline dark:text-brand-300">Details →</Link>}>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {d.health.map((s) => (
              <div key={s.name} className="flex items-center justify-between gap-2 rounded-xl bg-gray-50 px-3 py-2 dark:bg-white/[0.04]">
                <span className="truncate text-[13px] text-gray-700 dark:text-gray-300" title={s.name}>{s.name}</span>
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
        <StatCard label="Blind validation" value={d.cases ? `${myRatings}/${d.cases}` : "—"} hint={d.cases ? "Cases you've rated" : "No test cases generated yet"} tone={!d.cases || myRatings >= d.cases ? "brand" : "amber"} />
        <StatCard label="Changes this week" value={changes} hint={flagged ? `${flagged} flagged access events` : "No flagged access events"} tone={flagged ? "red" : "gray"} />
      </div>

      {group === "sysadmin" && <AnalyticsBlock d={d} />}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <Card title="Upcoming barangay aid schedules" className="xl:col-span-3" actions={<Link href="/admin/schedules" className="text-xs font-semibold text-brand-700 hover:underline dark:text-brand-300">Manage →</Link>}>
          {upcoming.length === 0 ? (
            <EmptyState title="No upcoming schedules">Add one so citizens know when and where to go.</EmptyState>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-white/5">
              {upcoming.slice(0, 5).map((s) => (
                <li key={s.schedule_id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="flex w-12 shrink-0 flex-col items-center rounded-xl bg-brand-50 py-1.5 text-brand-800 dark:bg-brand-500/10 dark:text-brand-300">
                    <span className="text-[10px] font-semibold uppercase">{new Date(`${s.start_date}T00:00:00`).toLocaleDateString("en-PH", { month: "short" })}</span>
                    <span className="text-lg font-bold leading-none">{Number(s.start_date.slice(8, 10))}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-gray-900 dark:text-white">{programName(s.program_id)}</p>
                    <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                      {officeName(s.office_id)} · until {fmtDate(`${s.end_date}T00:00:00`)}
                    </p>
                  </div>
                  {s.start_date <= today && <Badge tone="green" dot>Ongoing</Badge>}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Recent activity" className="xl:col-span-2" actions={<Link href="/admin/audit-logs" className="text-xs font-semibold text-brand-700 hover:underline dark:text-brand-300">Audit trail →</Link>}>
          {d.audit.length === 0 ? (
            <p className="text-sm text-gray-500">No activity yet.</p>
          ) : (
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
          )}
        </Card>
      </div>
    </div>
  );
}
