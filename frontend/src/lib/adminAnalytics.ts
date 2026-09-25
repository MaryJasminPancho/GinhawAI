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
