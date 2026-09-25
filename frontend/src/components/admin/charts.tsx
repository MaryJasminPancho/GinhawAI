"use client";

// Small dependency-free SVG/HTML charts for the admin dashboards.
// Single-series charts use the brand green; risk tiers use the same
// red / amber / green as the citizen Vulnerability Score screen, and are
// always labelled in text so color is never the only cue.

import { useState } from "react";
import { TIER_META, fmtNum } from "./ui";

type Point = { label: string; value: number; sub?: string };

/** Vertical columns over time (single series) with a hover tooltip. */
export function ColumnChart({ data, height = 180, format = fmtNum, ariaLabel }: { data: Point[]; height?: number; format?: (n: number) => string; ariaLabel: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value));
  // Counts get whole-number ticks (no "0.5 assessments"); rates keep fractions.
  const counts = data.every((d) => Number.isInteger(d.value));
  const ticks = counts ? [...new Set([0, Math.round(max / 2), max])] : [0, max / 2, max];

  return (
    <div className="relative" role="img" aria-label={ariaLabel}>
      <div className="flex gap-2">
        <div className="flex flex-col justify-between pb-6 text-right text-[10px] tabular-nums text-gray-400 dark:text-gray-500" style={{ height }}>
          {[...ticks].reverse().map((t, i) => (
            <span key={i}>{format(t)}</span>
          ))}
        </div>
        <div className="relative flex-1">
          {/* recessive grid */}
          <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col justify-between" style={{ height: height - 24 }}>
            {ticks.map((_, i) => (
              <div key={i} className="border-t border-dashed border-gray-100 dark:border-white/5" />
            ))}
          </div>
          <div className="relative flex items-end gap-[2px]" style={{ height: height - 24 }}>
            {data.map((d, i) => (
              <div
                key={d.label}
                className="group relative flex h-full flex-1 cursor-default items-end justify-center"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              >
                <div
                  className={`w-full max-w-[28px] rounded-t-[4px] transition-colors ${hover === i ? "bg-brand-700 dark:bg-brand-300" : "bg-brand-500 dark:bg-brand-400"}`}
                  style={{ height: `${(d.value / max) * 100}%`, minHeight: d.value > 0 ? 2 : 0 }}
                />
                {hover === i && (
                  <div className="pointer-events-none absolute bottom-full z-10 mb-1 whitespace-nowrap rounded-lg bg-gray-900 px-2.5 py-1.5 text-[11px] text-white shadow-lg dark:bg-white dark:text-gray-900">
                    <div className="font-semibold">{d.label}</div>
                    <div className="tabular-nums">{format(d.value)}</div>
                    {d.sub && <div className="opacity-70">{d.sub}</div>}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="mt-1.5 flex gap-[2px]">
            {data.map((d, i) => (
              <span
                key={d.label}
                className={`flex-1 truncate text-center text-[10px] text-gray-400 dark:text-gray-500 ${data.length > 8 && i % 2 === 1 ? "invisible sm:visible" : ""}`}
              >
                {d.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Ranked horizontal bars with direct value labels (e.g. top barangays). */
export function BarList({ data, format = fmtNum, max: forcedMax }: { data: Point[]; format?: (n: number) => string; max?: number }) {
  const max = forcedMax ?? Math.max(1, ...data.map((d) => d.value));
  return (
    <ul className="space-y-2.5">
      {data.map((d) => (
        <li key={d.label} className="group" title={`${d.label}: ${format(d.value)}${d.sub ? ` · ${d.sub}` : ""}`}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-[13px]">
            <span className="truncate text-gray-700 dark:text-gray-300">{d.label}</span>
            <span className="shrink-0 font-semibold tabular-nums text-gray-900 dark:text-white">
              {format(d.value)}
              {d.sub && <span className="ml-1.5 font-normal text-gray-400 dark:text-gray-500">{d.sub}</span>}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-white/5">
            <div className="h-full rounded-full bg-brand-500 transition-all group-hover:bg-brand-700 dark:bg-brand-400 dark:group-hover:bg-brand-300" style={{ width: `${(d.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** One 100% bar split into high / moderate / low, with a labelled legend below. */
export function TierStack({ high, moderate, low }: { high: number; moderate: number; low: number }) {
  const total = Math.max(1, high + moderate + low);
  const parts = [
    { key: "high" as const, n: high },
    { key: "moderate" as const, n: moderate },
    { key: "low" as const, n: low },
  ];
  return (
    <div>
      <div className="flex h-3 gap-[2px] overflow-hidden rounded-full">
        {parts.map((p) =>
          p.n > 0 ? (
            <div key={p.key} title={`${TIER_META[p.key].label}: ${fmtNum(p.n)}`} style={{ width: `${(p.n / total) * 100}%`, background: TIER_META[p.key].color }} />
          ) : null
        )}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {parts.map((p) => (
          <div key={p.key}>
            <div className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400">
              <span className="h-2 w-2 rounded-full" style={{ background: TIER_META[p.key].color }} />
              {TIER_META[p.key].label}
            </div>
            <div className="mt-0.5 text-sm font-semibold tabular-nums text-gray-900 dark:text-white">
              {fmtNum(p.n)} <span className="text-xs font-normal text-gray-400">{Math.round((p.n / total) * 100)}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Tiny trend line for stat tiles. */
export function Sparkline({ values, className = "" }: { values: number[]; className?: string }) {
  if (values.length < 2) return null;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 100},${28 - ((v - min) / Math.max(1, max - min)) * 24}`).join(" ");
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className={`h-8 w-full ${className}`} aria-hidden="true">
      <polyline points={pts} fill="none" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" className="stroke-brand-500 dark:stroke-brand-400" />
    </svg>
  );
}
