// Aggregations over anonymized demand_logs rows, shared by the dashboard,
// heatmap and reports screens. Pure functions — easy to move server-side later.

import { DemandCell, MONTHS, Tier } from "./adminApi";

// Short labels for charts. Keys match the mock program ids; null = no program matched.
export const PROGRAM_SHORT: Record<string, string> = {
  "p-4ps": "4Ps",
  "p-aics": "AICS",
  "p-tupad": "TUPAD",
  "p-feed": "Supplemental Feeding",
  "p-senior": "Senior Citizens Aid",
};
export const programShort = (id: string | null) => (id ? PROGRAM_SHORT[id] ?? id : "No program matched");

export type Range = "3m" | "6m" | "12m";
export const RANGE_OPTIONS: { value: Range; label: string }[] = [
  { value: "3m", label: "3 months" },
  { value: "6m", label: "6 months" },
  { value: "12m", label: "12 months" },
];
export const monthsFor = (r: Range) => MONTHS.slice(-{ "3m": 3, "6m": 6, "12m": 12 }[r]);

export function filterDemand(cells: DemandCell[], months: string[], program: string = "all") {
  const set = new Set(months);
  return cells.filter((c) => set.has(c.month) && (program === "all" || c.program_id === program));
}

export const sum = (cells: DemandCell[]) => cells.reduce((a, c) => a + c.count, 0);

export function byMonth(cells: DemandCell[], months: string[]) {
  const m = new Map(months.map((x) => [x, 0]));
  for (const c of cells) if (m.has(c.month)) m.set(c.month, m.get(c.month)! + c.count);
  return months.map((x) => ({ month: x, value: m.get(x)! }));
}

export function byTier(cells: DemandCell[]): Record<Tier, number> {
  const out = { high: 0, moderate: 0, low: 0 };
  for (const c of cells) out[c.tier] += c.count;
  return out;
}

export type BarangayAgg = { code: string; high: number; moderate: number; low: number; total: number; gap: number };

export function byBarangay(cells: DemandCell[]): BarangayAgg[] {
  const m = new Map<string, BarangayAgg>();
  for (const c of cells) {
    const row = m.get(c.barangay_code) ?? { code: c.barangay_code, high: 0, moderate: 0, low: 0, total: 0, gap: 0 };
    row[c.tier] += c.count;
    row.total += c.count;
    if (c.program_id === null) row.gap += c.count;
    m.set(c.barangay_code, row);
  }
  return [...m.values()].sort((a, b) => b.total - a.total);
}

export function byProgram(cells: DemandCell[]) {
  const m = new Map<string | null, number>();
  for (const c of cells) m.set(c.program_id, (m.get(c.program_id) ?? 0) + c.count);
  return [...m.entries()].map(([id, value]) => ({ id, value })).sort((a, b) => b.value - a.value);
}

/** Percent change of the last month vs the one before it. */
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
