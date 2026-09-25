"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";
import { BarList, ColumnChart, TierStack } from "@/components/admin/charts";
import { Badge, Btn, Card, downloadCsv, ErrorText, fmtDateTime, fmtMonth, fmtNum, fmtPct, Loading, PageTitle, PrivacyChip, SampleDataNotice, Segmented, StatCard, Table, td, th } from "@/components/admin/ui";
import { Barangay, DemandCell, DocDeficiency, Feedback, getDemandLogs, getDocumentDeficiency, getFeedback, getSmsStats, LIVE, listBarangays, SmsLog, SmsMonth } from "@/lib/adminApi";
import { byBarangay, byMonth, byProgram, byTier, filterDemand, monthsFor, PROGRAM_SHORT, programShort, Range, RANGE_OPTIONS, sum, susGrade } from "@/lib/adminAnalytics";

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

type Data = { demand: DemandCell[]; barangays: Barangay[]; docs: DocDeficiency[]; sms: { months: SmsMonth[]; recent: SmsLog[] }; feedback: Feedback[] };
type Built = { summary: ReactNode; body: ReactNode; csv: (string | number | null)[][] };

export default function ReportsPage() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<ReportId>("demand");
  const [range, setRange] = useState<Range>("6m");

  useEffect(() => {
    Promise.all([getDemandLogs(), listBarangays(), getDocumentDeficiency(), getSmsStats(), getFeedback()])
      .then(([demand, barangays, docs, sms, feedback]) => setData({ demand, barangays, docs, sms, feedback }))
      .catch((e) => setError(e.message));
  }, []);

  const months = useMemo(() => monthsFor(range), [range]);
  const meta = REPORTS.find((r) => r.id === report)!;
  const built = data ? build(report, data, months) : null;

  return (
    <>
      <PageTitle title="Reports & Exports" description="Planning reports built from anonymized, aggregated data. Download a spreadsheet for analysis or print a summary for meetings." actions={<PrivacyChip />} />
      {!LIVE.analytics && <SampleDataNotice what="Reports" />}
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
              <Btn variant="secondary" disabled={!built} onClick={() => built && downloadCsv(`ginhawai-${report}-${range}.csv`, built.csv)}>Download CSV</Btn>
              <Btn disabled={!built} onClick={() => window.print()}>Print / Save PDF</Btn>
            </div>
          </div>

          {!built && !error && <Loading />}
          {built && (
            <article className="space-y-4">
              <header className="hidden print:block">
                <p className="text-xs">GinhawAI · Cebu City · Generated {new Date().toLocaleString("en-PH")}</p>
              </header>
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">{meta.title}</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {fmtMonth(months[0])} – {fmtMonth(months[months.length - 1])} · Anonymized aggregate data (RA 10173)
                </p>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">{built.summary}</div>
              {built.body}
            </article>
          )}
        </div>
      </div>
    </>
  );
}

function build(id: ReportId, d: Data, months: string[]): Built {
  const names = Object.fromEntries(d.barangays.map((b) => [b.barangay_code, b.barangay_name]));
  const cells = filterDemand(d.demand, months);
  const total = sum(cells);

  if (id === "demand") {
    const trend = byMonth(cells, months);
    const progIds = Object.keys(PROGRAM_SHORT).filter((p) => cells.some((c) => c.program_id === p));
    const perProg = (m: string, p: string) => cells.filter((c) => c.month === m && c.program_id === p).reduce((a, c) => a + c.count, 0);
    const peak = trend.reduce((a, b) => (b.value > a.value ? b : a));
    const top = byProgram(cells).filter((p) => p.id)[0];
    return {
      summary: (
        <>
          <StatCard label="Total assessments" value={fmtNum(total)} />
          <StatCard label="Peak month" value={fmtMonth(peak.month)} hint={`${fmtNum(peak.value)} assessments`} />
          <StatCard label="Most requested" value={programShort(top?.id ?? null)} hint={`${fmtPct((top?.value ?? 0) / Math.max(1, total))} of matches`} />
        </>
      ),
      body: (
        <>
          <Card title="Assessments per month">
            <ColumnChart ariaLabel="Assessments per month" data={trend.map((t) => ({ label: fmtMonth(t.month), value: t.value }))} />
          </Card>
          <Card title="By program">
            <Table>
              <thead>
                <tr>
                  <th className={th}>Month</th>
                  {progIds.map((p) => <th key={p} className={`${th} text-right`}>{PROGRAM_SHORT[p]}</th>)}
                  <th className={`${th} text-right`}>No match</th>
                </tr>
              </thead>
              <tbody>
                {months.map((m) => (
                  <tr key={m}>
                    <td className={td}>{fmtMonth(m)}</td>
                    {progIds.map((p) => <td key={p} className={`${td} text-right tabular-nums`}>{fmtNum(perProg(m, p))}</td>)}
                    <td className={`${td} text-right tabular-nums`}>{fmtNum(cells.filter((c) => c.month === m && c.program_id === null).reduce((a, c) => a + c.count, 0))}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        </>
      ),
      csv: [["month", ...progIds.map((p) => PROGRAM_SHORT[p]), "total"], ...months.map((m, i) => [m, ...progIds.map((p) => perProg(m, p)), trend[i].value])],
    };
  }

  if (id === "gap" || id === "density") {
    const aggs = byBarangay(cells);
    if (id === "gap") {
      const gap = aggs.reduce((a, b) => a + b.gap, 0);
      const ranked = [...aggs].sort((a, b) => b.gap / b.total - a.gap / a.total);
      return {
        summary: (
          <>
            <StatCard label="Households with no match" value={fmtNum(gap)} tone="amber" />
            <StatCard label="Gap rate" value={fmtPct(gap / Math.max(1, total))} hint="of all assessments" tone="amber" />
            <StatCard label="Highest gap" value={names[ranked[0]?.code] ?? "—"} hint={ranked[0] ? `${fmtPct(ranked[0].gap / ranked[0].total)} unmatched` : undefined} />
          </>
        ),
        body: (
          <Card title="Gap rate by barangay" subtitle="Share of assessed households that qualified for no active program — a signal for new local programs.">
            <BarList data={ranked.map((a) => ({ label: names[a.code] ?? a.code, value: a.gap / a.total, sub: `${fmtNum(a.gap)} of ${fmtNum(a.total)}` }))} format={(v) => fmtPct(v)} />
          </Card>
        ),
        csv: [["barangay_code", "barangay", "assessments", "no_program_matched", "gap_rate"], ...ranked.map((a) => [a.code, names[a.code] ?? "", a.total, a.gap, +(a.gap / a.total).toFixed(4)])],
      };
    }
    const tiers = byTier(cells);
    return {
      summary: (
        <>
          <StatCard label="High risk" value={fmtNum(tiers.high)} hint={fmtPct(tiers.high / Math.max(1, total))} tone="red" />
          <StatCard label="Moderate risk" value={fmtNum(tiers.moderate)} hint={fmtPct(tiers.moderate / Math.max(1, total))} tone="amber" />
          <StatCard label="Low risk" value={fmtNum(tiers.low)} hint={fmtPct(tiers.low / Math.max(1, total))} />
        </>
      ),
      body: (
        <Card title="Risk tiers by barangay" subtitle="Sorted by number of high-risk households">
          <div className="space-y-4">
            {[...aggs].sort((a, b) => b.high - a.high).map((a) => (
              <div key={a.code}>
                <p className="mb-1.5 text-[13px] font-semibold text-gray-800 dark:text-gray-200">
                  {names[a.code] ?? a.code} <span className="font-normal text-gray-400">· {fmtNum(a.total)}</span>
                </p>
                <TierStack high={a.high} moderate={a.moderate} low={a.low} />
              </div>
            ))}
          </div>
        </Card>
      ),
      csv: [["barangay_code", "barangay", "high", "moderate", "low", "total", "high_share"], ...aggs.map((a) => [a.code, names[a.code] ?? "", a.high, a.moderate, a.low, a.total, +(a.high / a.total).toFixed(4)])],
    };
  }

  if (id === "documents") {
    const ranked = [...d.docs].sort((a, b) => b.missing_count / b.checked_count - a.missing_count / a.checked_count);
    const worst = ranked[0];
    return {
      summary: (
        <>
          <StatCard label="Most often missing" value={<span className="text-lg leading-tight">{worst.document_name}</span>} hint={fmtPct(worst.missing_count / worst.checked_count)} tone="amber" />
          <StatCard label="Checklists generated" value={fmtNum(d.docs.reduce((a, x) => a + x.checked_count, 0))} />
          <StatCard label="Documents tracked" value={d.docs.length} />
        </>
      ),
      body: (
        <Card title="Share of households lacking each document" subtitle="Helps plan help desks, e.g. PSA or indigency certificate drives.">
          <BarList data={ranked.map((x) => ({ label: `${x.document_name} · ${programShort(x.program_id)}`, value: x.missing_count / x.checked_count, sub: `${fmtNum(x.missing_count)} of ${fmtNum(x.checked_count)}` }))} format={(v) => fmtPct(v)} max={1} />
        </Card>
      ),
      csv: [["document", "program", "missing", "checked", "missing_rate"], ...ranked.map((x) => [x.document_name, programShort(x.program_id), x.missing_count, x.checked_count, +(x.missing_count / x.checked_count).toFixed(4)])],
    };
  }

  if (id === "sms") {
    const set = new Set(months);
    const ms = d.sms.months.filter((m) => set.has(m.month));
    const delivered = ms.reduce((a, m) => a + m.delivered, 0);
    const failed = ms.reduce((a, m) => a + m.failed, 0);
    const rate = delivered / Math.max(1, delivered + failed);
    return {
      summary: (
        <>
          <StatCard label="Delivery success rate" value={fmtPct(rate)} tone={rate >= 0.95 ? "brand" : "amber"} />
          <StatCard label="Delivered" value={fmtNum(delivered)} />
          <StatCard label="Failed" value={fmtNum(failed)} tone="red" />
        </>
      ),
      body: (
        <>
          <Card title="Success rate per month">
            <ColumnChart ariaLabel="SMS delivery success rate per month" data={ms.map((m) => ({ label: fmtMonth(m.month), value: m.delivered / (m.delivered + m.failed), sub: `${fmtNum(m.failed)} failed` }))} format={(v) => fmtPct(v, 0)} />
          </Card>
          <Card title="Recent dispatches" subtitle="Recipient numbers are masked at the gateway.">
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
                    <td className={td}>{programShort(s.program_id)}</td>
                    <td className={td}>
                      <Badge tone={s.delivery_status === "DELIVERED" ? "green" : s.delivery_status === "FAILED" ? "red" : "amber"} dot>{s.delivery_status.toLowerCase()}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        </>
      ),
      csv: [["month", "delivered", "failed", "success_rate"], ...ms.map((m) => [m.month, m.delivered, m.failed, +(m.delivered / (m.delivered + m.failed)).toFixed(4)])],
    };
  }

  // satisfaction
  const from = `${months[0]}-01`;
  const fb = d.feedback.filter((f) => f.submitted_at >= from);
  const avg = fb.reduce((a, f) => a + f.sus_score, 0) / Math.max(1, fb.length);
  const grades = ["Excellent", "Good", "OK", "Poor"].map((g) => ({ label: g, value: fb.filter((f) => susGrade(f.sus_score) === g).length }));
  const comments = fb.filter((f) => f.qualitative_feedback).slice(0, 8);
  return {
    summary: (
      <>
        <StatCard label="Average SUS score" value={avg.toFixed(1)} hint={`${susGrade(avg)} · benchmark 68`} tone={avg >= 68 ? "brand" : "amber"} />
        <StatCard label="Responses" value={fmtNum(fb.length)} />
        <StatCard label="Above benchmark" value={fmtPct(fb.filter((f) => f.sus_score >= 68).length / Math.max(1, fb.length), 0)} hint="SUS ≥ 68" />
      </>
    ),
    body: (
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card title="Score distribution" subtitle="Adjective ratings (Bangor et al.)">
          <BarList data={grades} max={Math.max(1, fb.length)} />
        </Card>
        <Card title="What citizens said" subtitle="Optional comments, no personal information collected">
          <ul className="space-y-2">
            {comments.map((c) => (
              <li key={c.feedback_id} className="rounded-2xl rounded-bl-sm bg-gray-100 px-4 py-2.5 text-[13px] text-gray-800 dark:bg-white/[0.06] dark:text-gray-100">
                “{c.qualitative_feedback}” <span className="ml-1 text-xs text-gray-400">SUS {c.sus_score}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    ),
    csv: [["submitted_at", "sus_score", "grade", "comment"], ...fb.map((f) => [f.submitted_at, f.sus_score, susGrade(f.sus_score), f.qualitative_feedback])],
  };
}
