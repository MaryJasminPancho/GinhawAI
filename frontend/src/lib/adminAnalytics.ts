// Aggregations over the anonymized demand data from /api/analytics/demand,
// shared by the dashboard, heatmap and reports screens.

import { AdminProgram, AssessmentRow, DemandData, shortProgramName, Tier } from "./adminApi";

export type Range = "3m" | "6m" | "12m";
export const RANGE_OPTIONS: { value: Range; label: string }[] = [
  { value: "3m", label: "3 months" },
  { value: "6m", label: "6 months" },
  { value: "12m", label: "12 months" },
];
export const monthsFor = (all: string[], r: Range) => all.slice(-{ "3m": 3, "6m": 6, "12m": 12 }[r]);

/** Assessment rows for the chosen months. With a program chosen, only
 * assessments that matched that program are counted (gap is then 0). */
export function filterDemand(d: DemandData, months: string[], program = "all"): AssessmentRow[] {
  const set = new Set(months);
  if (program === "all") return d.assessments.filter((r) => set.has(r.month));
  return d.matches
    .filter((r) => set.has(r.month) && r.program_id === program)
    .map((r) => ({ month: r.month, barangay_code: r.barangay_code, tier: r.tier, count: r.count, gap: 0 }));
}

export const sum = (rows: { count: number }[]) => rows.reduce((a, r) => a + r.count, 0);

export function byMonth(rows: AssessmentRow[], months: string[]) {
  const m = new Map(months.map((x) => [x, 0]));
  for (const r of rows) if (m.has(r.month)) m.set(r.month, m.get(r.month)! + r.count);
  return months.map((x) => ({ month: x, value: m.get(x)! }));
}

export function byTier(rows: AssessmentRow[]): Record<Tier, number> {
  const out = { high: 0, moderate: 0, low: 0 };
  for (const r of rows) out[r.tier] += r.count;
  return out;
}

export type BarangayAgg = { code: string; high: number; moderate: number; low: number; total: number; gap: number };
export const UNTAGGED = "__none__";

export function byBarangay(rows: AssessmentRow[]): BarangayAgg[] {
  const m = new Map<string, BarangayAgg>();
  for (const r of rows) {
    const code = r.barangay_code ?? UNTAGGED;
    const row = m.get(code) ?? { code, high: 0, moderate: 0, low: 0, total: 0, gap: 0 };
    row[r.tier] += r.count;
    row.total += r.count;
    row.gap += r.gap;
    m.set(code, row);
  }
  return [...m.values()].sort((a, b) => b.total - a.total);
}

/** "Trend Volatile Multi-Household Scoring": how each barangay's high-risk share
 * moved between the last two months, and how much it swings month to month. */
export type BarangayTrend = {
  code: string;
  prev: number | null; // high-risk share last-but-one month (null = too few assessments)
  last: number | null; // high-risk share last month
  change: number | null; // last - prev, in share points (0.12 = +12 points)
  direction: "rising" | "falling" | "steady" | "unknown";
  volatility: number | null; // spread (standard deviation) of the monthly share
  volatile: boolean;
};
export const MIN_MONTH_SAMPLE = 3; // months with fewer assessments are too noisy to compare
export const TREND_THRESHOLD = 0.1; // 10 share points
export const VOLATILE_THRESHOLD = 0.2;

export function barangayTrends(rows: AssessmentRow[], months: string[]): BarangayTrend[] {
  const cells = new Map<string, Map<string, { high: number; total: number }>>();
  for (const r of rows) {
    const code = r.barangay_code ?? UNTAGGED;
    const byM = cells.get(code) ?? new Map();
    const c = byM.get(r.month) ?? { high: 0, total: 0 };
    c.total += r.count;
    if (r.tier === "high") c.high += r.count;
    byM.set(r.month, c);
    cells.set(code, byM);
  }
  const share = (c?: { high: number; total: number }) => (c && c.total >= MIN_MONTH_SAMPLE ? c.high / c.total : null);
  const [m1, m2] = months.slice(-2);
  return [...cells.entries()].map(([code, byM]) => {
    const prev = months.length >= 2 ? share(byM.get(m1)) : null;
    const last = share(byM.get(months.length >= 2 ? m2 : m1));
    const change = prev !== null && last !== null ? last - prev : null;
    const series = months.map((m) => share(byM.get(m))).filter((v): v is number => v !== null);
    let volatility: number | null = null;
    if (series.length >= 3) {
      const mean = series.reduce((a, v) => a + v, 0) / series.length;
      volatility = Math.sqrt(series.reduce((a, v) => a + (v - mean) ** 2, 0) / series.length);
    }
    const direction =
      change === null ? "unknown" : change >= TREND_THRESHOLD ? "rising" : change <= -TREND_THRESHOLD ? "falling" : "steady";
    return { code, prev, last, change, direction, volatility, volatile: volatility !== null && volatility >= VOLATILE_THRESHOLD };
  });
}

/** How many assessments matched each program (for the chosen months / barangay). */
export function byProgram(d: DemandData, months: string[], barangay?: string | null) {
  const set = new Set(months);
  const m = new Map<string, number>();
  for (const r of d.matches) {
    if (!set.has(r.month)) continue;
    if (barangay !== undefined && (r.barangay_code ?? UNTAGGED) !== barangay) continue;
    m.set(r.program_id, (m.get(r.program_id) ?? 0) + r.count);
  }
  return [...m.entries()].map(([id, value]) => ({ id, value })).sort((a, b) => b.value - a.value);
}

export function programLabel(programs: AdminProgram[], id: string | null) {
  if (!id) return "No program matched";
  const p = programs.find((x) => x.program_id === id);
  return p ? shortProgramName(p.program_name) : "Removed program";
}

export function lastMonthChange(series: { value: number }[]) {
  if (series.length < 2) return 0;
  const a = series[series.length - 2].value;
  const b = series[series.length - 1].value;
  return a === 0 ? 0 : (b - a) / a;
}

// Adjusted SUS score -> adjective (Bangor et al.), used by the satisfaction report.
export function susGrade(score: number) {
  if (score >= 85) return "Excellent";
  if (score >= 72) return "Good";
  if (score >= 52) return "OK";
  return "Poor";
}
