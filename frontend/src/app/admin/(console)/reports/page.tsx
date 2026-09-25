"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";
import { BarList, ColumnChart, TierStack } from "@/components/admin/charts";
import { Badge, Btn, Card, downloadCsv, EmptyState, ErrorText, fmtDateTime, fmtMonth, fmtNum, fmtPct, Loading, PageTitle, PrivacyChip, Segmented, StatCard, Table, td, th } from "@/components/admin/ui";
import {
  AdminProgram,
  Barangay,
  DemandData,
  DocDeficiency,
  Feedback,
  getDemand,
  getDocumentDeficiency,
  getFeedback,
  getSmsStats,
  listBarangays,
  listPrograms,
  shortProgramName,
  SmsLog,
  SmsMonth,
} from "@/lib/adminApi";
import { byBarangay, byMonth, byProgram, byTier, filterDemand, monthsFor, programLabel, Range, RANGE_OPTIONS, sum, susGrade, UNTAGGED } from "@/lib/adminAnalytics";

// "Export Policy Intelligence Reports" (Fig. 10) and its six <<includes>>.
// Each report can be downloaded as a spreadsheet (CSV) or printed / saved as PDF.

type ReportId = "demand" | "gap" | "density" | "documents" | "sms" | "satisfaction";

const REPORTS: { id: ReportId; title: string; blurb: string }[] = [
  { id: "demand", title: "Aid Demand Trend Summary", blurb: "Assessments per month, by program." },
  { id: "gap", title: "Eligibility Gap Report", blurb: "Households that matched no program, by barangay." },
  { id: "density", title: "Vulnerability Heatmap Density", blurb: "Risk tiers per barangay." },
  { id: "documents", title: "Document Deficiency Summary", blurb: "Documents citizens most often lack." },
  { id: "sms", title: "SMS Delivery Success Log", blurb: "Semaphore checklist delivery rates." },
  { id: "satisfaction", title: "Aggregate User Satisfaction", blurb: "SUS scores and citizen comments." },
];

type Data = { demand: DemandData; barangays: Barangay[]; programs: AdminProgram[]; docs: DocDeficiency[]; sms: { months: SmsMonth[]; recent: SmsLog[] }; feedback: Feedback[] };
type Built = { summary: ReactNode; body: ReactNode; csv: (string | number | null)[][]; empty?: string };

export default function ReportsPage() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<ReportId>("demand");
  const [range, setRange] = useState<Range>("6m");

  useEffect(() => {
    Promise.all([getDemand(12), listBarangays(), listPrograms(), getDocumentDeficiency(12), getSmsStats(12), getFeedback(12)])
      .then(([demand, barangays, programs, docs, sms, feedback]) => setData({ demand, barangays, programs, docs, sms, feedback }))
      .catch((e) => setError(e.message));
  }, []);

  const months = useMemo(() => (data ? monthsFor(data.demand.months, range) : []), [data, range]);
  const meta = REPORTS.find((r) => r.id === report)!;
  const built = data ? build(report, data, months) : null;

  return (
    <>
      <PageTitle title="Reports & Exports" description="Planning reports built from anonymized, aggregated data. Download a spreadsheet for analysis or print a summary for meetings." actions={<PrivacyChip />} />
      {error && <div className="mb-4"><ErrorText>{error}</ErrorText></div>}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
        <nav aria-label="Reports" className="h-fit print:hidden">
          <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-1">
            {REPORTS.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => setReport(r.id)}
                  aria-current={report === r.id ? "true" : undefined}
                  className={`w-full rounded-2xl p-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                    report === r.id ? "bg-white shadow-sm ring-1 ring-brand-300 dark:bg-white/[0.06] dark:ring-brand-500/40" : "hover:bg-white/70 dark:hover:bg-white/[0.03]"
                  }`}
                >
                  <p className={`text-[13px] font-semibold ${report === r.id ? "text-brand-800 dark:text-brand-300" : "text-gray-800 dark:text-gray-200"}`}>{r.title}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{r.blurb}</p>
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between print:hidden">
            <Segmented label="Period" value={range} onChange={setRange} options={RANGE_OPTIONS} />
            <div className="flex gap-2">
              <Btn variant="secondary" disabled={!built || !!built.empty} onClick={() => built && downloadCsv(`ginhawai-${report}-${range}.csv`, built.csv)}>Download CSV</Btn>
              <Btn disabled={!built || !!built.empty} onClick={() => window.print()}>Print / Save PDF</Btn>
            </div>
          </div>

          {!built && !error && <Loading />}
          {built && (
            <article className="space-y-4">
              <header className="hidden print:block">
                <p className="text-xs">GinhawAI · Generated {new Date().toLocaleString("en-PH")}</p>
              </header>
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">{meta.title}</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {fmtMonth(months[0])} – {fmtMonth(months[months.length - 1])} · Anonymized aggregate data (RA 10173)
                </p>
              </div>
              {built.empty ? (
                <EmptyState title="Nothing to report yet">{built.empty}</EmptyState>
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">{built.summary}</div>
                  {built.body}
                </>
              )}
            </article>
          )}
        </div>
      </div>
    </>
  );
}

function build(id: ReportId, d: Data, months: string[]): Built {
  const names = Object.fromEntries(d.barangays.map((b) => [b.barangay_code, b.barangay_name]));
  const bName = (code: string) => (code === UNTAGGED ? "Unlisted barangay" : names[code] ?? code);
  const rows = filterDemand(d.demand, months);
  const total = sum(rows);
  const noAssessments = "Reports fill in as citizens complete assessments.";

  if (id === "demand") {
    if (!total) return { summary: null, body: null, csv: [], empty: noAssessments };
    const trend = byMonth(rows, months);
    const matchedIds = byProgram(d.demand, months).map((p) => p.id);
    const perProg = (m: string, p: string) => d.demand.matches.filter((r) => r.month === m && r.program_id === p).reduce((a, r) => a + r.count, 0);
    const gapIn = (m: string) => rows.filter((r) => r.month === m).reduce((a, r) => a + r.gap, 0);
    const peak = trend.reduce((a, b) => (b.value > a.value ? b : a));
    const top = byProgram(d.demand, months)[0];
    return {
      summary: (
        <>
          <StatCard label="Total assessments" value={fmtNum(total)} />
          <StatCard label="Peak month" value={fmtMonth(peak.month)} hint={`${fmtNum(peak.value)} assessments`} />
          <StatCard label="Most matched program" value={top ? programLabel(d.programs, top.id) : "—"} hint={top ? `${fmtPct(top.value / total)} of assessments` : undefined} />
        </>
      ),
      body: (
        <>
          <Card title="Assessments per month">
            <ColumnChart ariaLabel="Assessments per month" data={trend.map((t) => ({ label: fmtMonth(t.month), value: t.value }))} />
          </Card>
          <Card title="Matches by program" subtitle="One household can match more than one program">
            <Table>
              <thead>
                <tr>
                  <th className={th}>Month</th>
                  {matchedIds.map((p) => <th key={p} className={`${th} text-right`}>{programLabel(d.programs, p)}</th>)}
                  <th className={`${th} text-right`}>No match</th>
                  <th className={`${th} text-right`}>Assessments</th>
                </tr>
              </thead>
              <tbody>
                {months.map((m, i) => (
                  <tr key={m}>
                    <td className={td}>{fmtMonth(m)}</td>
                    {matchedIds.map((p) => <td key={p} className={`${td} text-right tabular-nums`}>{fmtNum(perProg(m, p))}</td>)}
                    <td className={`${td} text-right tabular-nums`}>{fmtNum(gapIn(m))}</td>
                    <td className={`${td} text-right font-semibold tabular-nums`}>{fmtNum(trend[i].value)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        </>
      ),
      csv: [["month", ...matchedIds.map((p) => programLabel(d.programs, p)), "no_match", "assessments"], ...months.map((m, i) => [m, ...matchedIds.map((p) => perProg(m, p)), gapIn(m), trend[i].value])],
    };
  }

  if (id === "gap" || id === "density") {
    if (!total) return { summary: null, body: null, csv: [], empty: noAssessments };
    const aggs = byBarangay(rows);
    if (id === "gap") {
      const gap = aggs.reduce((a, b) => a + b.gap, 0);
      const ranked = [...aggs].sort((a, b) => b.gap / b.total - a.gap / a.total);
      return {
        summary: (
          <>
            <StatCard label="Households with no match" value={fmtNum(gap)} tone="amber" />
            <StatCard label="Gap rate" value={fmtPct(gap / total)} hint="of all assessments" tone="amber" />
            <StatCard label="Highest gap" value={ranked[0] ? bName(ranked[0].code) : "—"} hint={ranked[0] ? `${fmtPct(ranked[0].gap / ranked[0].total)} unmatched` : undefined} />
          </>
        ),
        body: (
          <Card title="Gap rate by barangay" subtitle="Share of assessed households that qualified for no active program — a signal for new local programs.">
            <BarList data={ranked.map((a) => ({ label: bName(a.code), value: a.gap / a.total, sub: `${fmtNum(a.gap)} of ${fmtNum(a.total)}` }))} format={(v) => fmtPct(v)} max={1} />
          </Card>
        ),
        csv: [["barangay_code", "barangay", "assessments", "no_program_matched", "gap_rate"], ...ranked.map((a) => [a.code === UNTAGGED ? "" : a.code, bName(a.code), a.total, a.gap, +(a.gap / a.total).toFixed(4)])],
      };
    }
    const tiers = byTier(rows);
    return {
      summary: (
        <>
          <StatCard label="High risk" value={fmtNum(tiers.high)} hint={fmtPct(tiers.high / total)} tone="red" />
          <StatCard label="Moderate risk" value={fmtNum(tiers.moderate)} hint={fmtPct(tiers.moderate / total)} tone="amber" />
          <StatCard label="Low risk" value={fmtNum(tiers.low)} hint={fmtPct(tiers.low / total)} />
        </>
      ),
      body: (
        <Card title="Risk tiers by barangay" subtitle="Sorted by number of high-risk households">
          <div className="space-y-4">
            {[...aggs].sort((a, b) => b.high - a.high).map((a) => (
              <div key={a.code}>
                <p className="mb-1.5 text-[13px] font-semibold text-gray-800 dark:text-gray-200">
                  {bName(a.code)} <span className="font-normal text-gray-400">· {fmtNum(a.total)}</span>
                </p>
                <TierStack high={a.high} moderate={a.moderate} low={a.low} />
              </div>
            ))}
          </div>
        </Card>
      ),
      csv: [["barangay_code", "barangay", "high", "moderate", "low", "total", "high_share"], ...aggs.map((a) => [a.code === UNTAGGED ? "" : a.code, bName(a.code), a.high, a.moderate, a.low, a.total, +(a.high / a.total).toFixed(4)])],
    };
  }

  if (id === "documents") {
    const docs = d.docs.filter((x) => x.checked_count > 0);
    if (!docs.length) return { summary: null, body: null, csv: [], empty: "This fills in when citizens tick which documents they already have on their checklist." };
    const ranked = [...docs].sort((a, b) => b.missing_count / b.checked_count - a.missing_count / a.checked_count);
    const worst = ranked[0];
    return {
      summary: (
        <>
          <StatCard label="Most often missing" value={<span className="text-lg leading-tight">{worst.document_name}</span>} hint={`${fmtPct(worst.missing_count / worst.checked_count)} don't have it`} tone="amber" />
          <StatCard label="Checklist answers" value={fmtNum(docs.reduce((a, x) => a + x.checked_count, 0))} />
          <StatCard label="Documents tracked" value={docs.length} />
        </>
      ),
      body: (
        <Card title="Share of households lacking each document" subtitle="Helps plan help desks, e.g. PSA or indigency certificate drives.">
          <BarList data={ranked.map((x) => ({ label: `${x.document_name} · ${shortProgramName(x.program_name)}`, value: x.missing_count / x.checked_count, sub: `${fmtNum(x.missing_count)} of ${fmtNum(x.checked_count)}` }))} format={(v) => fmtPct(v)} max={1} />
        </Card>
      ),
      csv: [["document", "program", "missing", "answered", "missing_rate"], ...ranked.map((x) => [x.document_name, x.program_name, x.missing_count, x.checked_count, +(x.missing_count / x.checked_count).toFixed(4)])],
    };
  }

  if (id === "sms") {
    const set = new Set(months);
    const ms = d.sms.months.filter((m) => set.has(m.month));
    const sent = ms.reduce((a, m) => a + m.sent, 0);
    const failed = ms.reduce((a, m) => a + m.failed, 0);
    if (!sent && !failed) return { summary: null, body: null, csv: [], empty: "No checklist SMS has been sent in this period." };
    const rate = sent / (sent + failed);
    return {
      summary: (
        <>
          <StatCard label="Success rate" value={fmtPct(rate)} hint="Accepted by the Semaphore gateway" tone={rate >= 0.95 ? "brand" : "amber"} />
          <StatCard label="Sent" value={fmtNum(sent)} />
          <StatCard label="Failed" value={fmtNum(failed)} tone="red" />
        </>
      ),
      body: (
        <>
          <Card title="Success rate per month">
            <ColumnChart ariaLabel="SMS success rate per month" data={ms.map((m) => ({ label: fmtMonth(m.month), value: m.sent + m.failed ? m.sent / (m.sent + m.failed) : 0, sub: `${fmtNum(m.sent + m.failed)} attempts` }))} format={(v) => fmtPct(v, 0)} />
          </Card>
          <Card title="Recent messages" subtitle="Recipient numbers are masked before they're logged.">
            <Table>
              <thead>
                <tr>
                  <th className={th}>Sent</th>
                  <th className={th}>Recipient</th>
                  <th className={th}>Checklist</th>
                  <th className={th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {d.sms.recent.slice(0, 12).map((s) => (
                  <tr key={s.sms_id}>
                    <td className={`${td} tabular-nums`}>{fmtDateTime(s.sent_at)}</td>
                    <td className={`${td} font-mono`}>{s.masked_recipient}</td>
                    <td className={td}>{shortProgramName(s.program_name)}</td>
                    <td className={td}><Badge tone={s.delivery_status === "FAILED" ? "red" : "green"} dot>{s.delivery_status.toLowerCase()}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        </>
      ),
      csv: [["month", "sent", "failed", "success_rate"], ...ms.map((m) => [m.month, m.sent, m.failed, m.sent + m.failed ? +(m.sent / (m.sent + m.failed)).toFixed(4) : null])],
    };
  }

  // satisfaction
  const from = `${months[0]}-01`;
  const fb = d.feedback.filter((f) => f.submitted_at >= from);
  if (!fb.length) return { summary: null, body: null, csv: [], empty: "No citizen feedback in this period yet." };
  const avg = fb.reduce((a, f) => a + f.sus_score, 0) / fb.length;
  const grades = ["Excellent", "Good", "OK", "Poor"].map((g) => ({ label: g, value: fb.filter((f) => susGrade(f.sus_score) === g).length }));
  const comments = fb.filter((f) => f.qualitative_feedback).slice(0, 8);
  return {
    summary: (
      <>
        <StatCard label="Average SUS score" value={avg.toFixed(1)} hint={`${susGrade(avg)} · benchmark 68`} tone={avg >= 68 ? "brand" : "amber"} />
        <StatCard label="Responses" value={fmtNum(fb.length)} />
        <StatCard label="Above benchmark" value={fmtPct(fb.filter((f) => f.sus_score >= 68).length / fb.length, 0)} hint="SUS ≥ 68" />
      </>
    ),
    body: (
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card title="Score distribution" subtitle="Adjective ratings (Bangor et al.)">
          <BarList data={grades} max={fb.length} />
        </Card>
        <Card title="What citizens said" subtitle="Optional comments, no personal information collected">
          {comments.length ? (
            <ul className="space-y-2">
              {comments.map((c) => (
                <li key={c.feedback_id} className="rounded-2xl rounded-bl-sm bg-gray-100 px-4 py-2.5 text-[13px] text-gray-800 dark:bg-white/[0.06] dark:text-gray-100">
                  “{c.qualitative_feedback}” <span className="ml-1 text-xs text-gray-400">SUS {c.sus_score}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500">No written comments yet.</p>
          )}
        </Card>
      </div>
    ),
    csv: [["submitted_at", "sus_score", "grade", "comment"], ...fb.map((f) => [f.submitted_at, f.sus_score, susGrade(f.sus_score), f.qualitative_feedback])],
  };
}
