"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { BarList, ColumnChart, TierStack } from "@/components/admin/charts";
import { Card, EmptyState, ErrorText, fmtMonth, fmtNum, fmtPct, inputClass, Loading, PageTitle, PrivacyChip, Segmented, Table, td, th } from "@/components/admin/ui";
import { RAMP, type MapPoint } from "@/components/admin/VulnerabilityMap";
import { AdminProgram, Barangay, DemandData, getDemand, listBarangays, listPrograms } from "@/lib/adminApi";
import { BarangayAgg, byBarangay, byMonth, byProgram, byTier, filterDemand, monthsFor, programLabel, Range, RANGE_OPTIONS, sum, UNTAGGED } from "@/lib/adminAnalytics";

// "View Geographic Vulnerability Heatmap" (Fig. 10). Built only from
// anonymized demand_logs aggregates: barangay × program × vulnerability tier × month.

const VulnerabilityMap = dynamic(() => import("@/components/admin/VulnerabilityMap"), {
  ssr: false,
  loading: () => <div className="h-[420px] animate-pulse rounded-2xl bg-gray-100 dark:bg-white/5" />,
});

type Metric = "high_share" | "high_count" | "gap";
const METRICS: { value: Metric; label: string; legend: string }[] = [
  { value: "high_share", label: "High-risk share", legend: "share of assessed households classified high risk" },
  { value: "high_count", label: "High-risk count", legend: "number of high-risk households" },
  { value: "gap", label: "Eligibility gap", legend: "households that matched no program" },
];

export default function AnalyticsPage() {
  const [demand, setDemand] = useState<DemandData | null>(null);
  const [barangays, setBarangays] = useState<Barangay[]>([]);
  const [programs, setPrograms] = useState<AdminProgram[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<Range>("6m");
  const [program, setProgram] = useState("all");
  const [metric, setMetric] = useState<Metric>("high_share");
  const [focus, setFocus] = useState<string | null>(null);
  const [showTable, setShowTable] = useState(false);

  useEffect(() => {
    Promise.all([getDemand(12), listBarangays(), listPrograms()])
      .then(([d, b, p]) => {
        setDemand(d);
        setBarangays(b);
        setPrograms(p);
      })
      .catch((e) => setError(e.message));
  }, []);

  const months = useMemo(() => (demand ? monthsFor(demand.months, range) : []), [demand, range]);
  const rows = useMemo(() => (demand ? filterDemand(demand, months, program) : []), [demand, months, program]);
  const aggs = useMemo(() => byBarangay(rows), [rows]);
  const bMeta = Object.fromEntries(barangays.map((b) => [b.barangay_code, b]));
  const bName = (code: string) => (code === UNTAGGED ? "Unlisted barangay" : bMeta[code]?.barangay_name ?? code);

  const valueOf = (a: BarangayAgg) => (metric === "high_share" ? a.high / Math.max(1, a.total) : metric === "high_count" ? a.high : a.gap);
  const fmtValue = (v: number) => (metric === "high_share" ? fmtPct(v, 0) : fmtNum(v));
  const metricMeta = METRICS.find((m) => m.value === metric)!;
  const points: MapPoint[] = aggs
    .filter((a) => bMeta[a.code]?.latitude != null && bMeta[a.code]?.longitude != null)
    .map((a) => ({
      code: a.code,
      name: bMeta[a.code].barangay_name,
      lat: bMeta[a.code].latitude!,
      lng: bMeta[a.code].longitude!,
      total: a.total,
      value: valueOf(a),
      label: `${metricMeta.label}: <strong>${fmtValue(valueOf(a))}</strong>`,
    }));
  const offMap = aggs.filter((a) => !points.some((p) => p.code === a.code)).reduce((n, a) => n + a.total, 0);
  const maxValue = Math.max(0, ...points.map((p) => p.value));
  const ranked = [...aggs].sort((a, b) => valueOf(b) - valueOf(a));

  const focusAgg = focus ? aggs.find((a) => a.code === focus) : null;
  const focusRows = focus ? rows.filter((r) => (r.barangay_code ?? UNTAGGED) === focus) : rows;
  const tiers = byTier(focusRows);
  const trend = byMonth(focusRows, months);
  const matched = demand ? byProgram(demand, months, focus ?? undefined) : [];
  const total = sum(rows);

  return (
    <>
      <PageTitle title="Vulnerability Heatmap" description="Where households with the greatest need are concentrated, based on completed assessments. No names, numbers or chat content are stored — only anonymized counts per barangay." actions={<PrivacyChip />} />
      {error && <div className="mb-4"><ErrorText>{error}</ErrorText></div>}

      {/* One filter row above all charts */}
      <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          <Segmented label="Time range" value={range} onChange={setRange} options={RANGE_OPTIONS} />
          <Segmented label="Map metric" value={metric} onChange={setMetric} options={METRICS} />
        </div>
        <select aria-label="Program" className={`${inputClass} lg:w-64`} value={program} onChange={(e) => setProgram(e.target.value)}>
          <option value="all">All assessments</option>
          {programs.map((p) => <option key={p.program_id} value={p.program_id}>Matched: {programLabel(programs, p.program_id)}</option>)}
        </select>
      </div>

      {!demand && !error && <Loading />}
      {demand && total === 0 && (
        <EmptyState title="No assessments in this period">
          The map fills in as citizens complete assessments. Each finished assessment adds one anonymized record for its barangay.
        </EmptyState>
      )}
      {demand && total > 0 && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <Card
              className="xl:col-span-2"
              title="Barangays"
              subtitle={`${fmtMonth(months[0])} – ${fmtMonth(months[months.length - 1])} · click a circle to focus`}
              actions={<button type="button" onClick={() => setShowTable((v) => !v)} className="text-xs font-semibold text-brand-700 hover:underline dark:text-brand-300">{showTable ? "Show map" : "Show as table"}</button>}
            >
              {showTable ? (
                <Table>
                  <thead>
                    <tr>
                      <th className={th}>Barangay</th>
                      <th className={`${th} text-right`}>Assessments</th>
                      <th className={`${th} text-right`}>High</th>
                      <th className={`${th} text-right`}>Moderate</th>
                      <th className={`${th} text-right`}>Low</th>
                      <th className={`${th} text-right`}>No match</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ranked.map((a) => (
                      <tr key={a.code}>
                        <td className={td}>{bName(a.code)}</td>
                        <td className={`${td} text-right tabular-nums`}>{fmtNum(a.total)}</td>
                        <td className={`${td} text-right tabular-nums`}>{fmtNum(a.high)}</td>
                        <td className={`${td} text-right tabular-nums`}>{fmtNum(a.moderate)}</td>
                        <td className={`${td} text-right tabular-nums`}>{fmtNum(a.low)}</td>
                        <td className={`${td} text-right tabular-nums`}>{fmtNum(a.gap)}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              ) : (
                <>
                  <VulnerabilityMap points={points} maxValue={maxValue} onSelect={setFocus} />
                  <div className="mt-3 flex flex-col gap-2 text-[11px] text-gray-500 sm:flex-row sm:items-center sm:justify-between dark:text-gray-400">
                    <div className="flex items-center gap-2">
                      <span>Low</span>
                      <div className="flex overflow-hidden rounded-full">
                        {RAMP.map((c) => <span key={c} className="h-2.5 w-7" style={{ background: c }} />)}
                      </div>
                      <span>High · {metricMeta.legend}</span>
                    </div>
                    <span>Circle size = number of assessments</span>
                  </div>
                  {offMap > 0 && (
                    <p className="mt-2 text-[11px] text-amber-700 dark:text-amber-300">
                      {fmtNum(offMap)} assessments are from barangays without map coordinates — add them in Office Directory → Barangays. They still count in the table and charts.
                    </p>
                  )}
                </>
              )}
            </Card>

            <Card
              title={focusAgg ? bName(focusAgg.code) : "All barangays"}
              subtitle={`${fmtNum(sum(focusRows))} assessments${program !== "all" ? ` · matched ${programLabel(programs, program)}` : ""}`}
              actions={focus ? <button type="button" onClick={() => setFocus(null)} className="text-xs font-semibold text-brand-700 hover:underline dark:text-brand-300">Clear</button> : undefined}
            >
              <TierStack {...tiers} />
              <p className="mb-3 mt-6 text-xs font-semibold text-gray-500 dark:text-gray-400">Programs matched</p>
              {matched.length ? <BarList data={matched.slice(0, 6).map((p) => ({ label: programLabel(programs, p.id), value: p.value }))} /> : <p className="text-xs text-gray-400">No program matches.</p>}
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Card title="Seasonal demand" subtitle={focusAgg ? `Assessments per month in ${bName(focusAgg.code)}` : "Assessments per month, all barangays"}>
              <ColumnChart ariaLabel="Assessments per month" data={trend.map((t) => ({ label: fmtMonth(t.month), value: t.value }))} />
            </Card>
            <Card title={`Top barangays · ${metricMeta.label.toLowerCase()}`} subtitle="Where outreach may have the most impact">
              <BarList
                data={ranked.slice(0, 8).map((a) => ({ label: bName(a.code), value: valueOf(a), sub: metric === "high_share" ? `${fmtNum(a.high)} of ${fmtNum(a.total)}` : undefined }))}
                format={fmtValue}
                max={metric === "high_share" ? 1 : undefined}
              />
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
