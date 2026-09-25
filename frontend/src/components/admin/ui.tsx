"use client";

// Building blocks for the admin console. They reuse the citizen side's look:
// brand-green gradients, rounded-2xl/3xl cards with a hairline ring, and the
// same dark-mode surfaces (white/[0.04] on #0a0f0c).

import { ReactNode, useEffect, useId, useRef } from "react";

export function PageTitle({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-xl font-bold tracking-tight text-gray-900 sm:text-2xl dark:text-white">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm leading-relaxed text-gray-500 dark:text-gray-400">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ children, className = "", title, subtitle, actions }: { children: ReactNode; className?: string; title?: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <section className={`rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5 dark:bg-white/[0.04] dark:ring-white/10 ${className}`}>
      {(title || actions) && (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            {title && <h2 className="text-[15px] font-semibold text-gray-900 dark:text-white">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{subtitle}</p>}
          </div>
          {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function StatCard({ label, value, hint, tone = "brand" }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "brand" | "red" | "amber" | "gray" }) {
  const bar = { brand: "from-brand-500 to-brand-700", red: "from-red-400 to-red-600", amber: "from-amber-400 to-amber-600", gray: "from-gray-300 to-gray-400" }[tone];
  return (
    <div className="relative overflow-hidden rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5 dark:bg-white/[0.04] dark:ring-white/10">
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${bar}`} />
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</p>
      <p className="mt-2 text-3xl font-extrabold tracking-tight text-gray-900 tabular-nums dark:text-white">{value}</p>
      {hint && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{hint}</p>}
    </div>
  );
}

type BadgeTone = "brand" | "red" | "amber" | "green" | "gray" | "blue";
const badgeTones: Record<BadgeTone, string> = {
  brand: "bg-brand-100 text-brand-800 dark:bg-brand-500/10 dark:text-brand-300",
  green: "bg-green-100 text-green-800 dark:bg-green-500/10 dark:text-green-300",
  red: "bg-red-100 text-red-800 dark:bg-red-500/10 dark:text-red-300",
  amber: "bg-amber-100 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300",
  gray: "bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-300",
  blue: "bg-sky-100 text-sky-800 dark:bg-sky-500/10 dark:text-sky-300",
};
const dotTones: Record<BadgeTone, string> = {
  brand: "bg-brand-600",
  green: "bg-green-500",
  red: "bg-red-500",
  amber: "bg-amber-500",
  gray: "bg-gray-400",
  blue: "bg-sky-500",
};

export function Badge({ children, tone = "gray", dot = false }: { children: ReactNode; tone?: BadgeTone; dot?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${badgeTones[tone]}`}>
      {dot && <span className={`h-1.5 w-1.5 rounded-full ${dotTones[tone]}`} />}
      {children}
    </span>
  );
}

// Same red / amber / green meaning as the citizen's Vulnerability Score screen (Fig. 18).
export const TIER_META = {
  high: { label: "High risk", tone: "red" as const, color: "#dc2626" },
  moderate: { label: "Moderate risk", tone: "amber" as const, color: "#d97706" },
  low: { label: "Low risk", tone: "green" as const, color: "#16a34a" },
};

export function TierBadge({ tier }: { tier: "high" | "moderate" | "low" }) {
  const m = TIER_META[tier];
  return (
    <Badge tone={m.tone} dot>
      {m.label}
    </Badge>
  );
}

/** Notice shown on pages that still run on mock data because the endpoint isn't built. */
export function SampleDataNotice({ what }: { what?: string }) {
  return (
    <div className="mb-5 flex items-start gap-2.5 rounded-2xl bg-amber-50 px-4 py-3 text-[13px] leading-relaxed text-amber-900 ring-1 ring-amber-200/70 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-500/20">
      <svg className="mt-0.5 shrink-0" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 8v4M12 16h.01" />
      </svg>
      <span>
        <strong className="font-semibold">Sample data.</strong> {what ?? "This screen"} isn&apos;t connected to the backend yet — numbers shown are placeholders.
      </span>
    </div>
  );
}

export function PrivacyChip() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-100/80 px-2.5 py-1 text-[11px] font-semibold text-brand-800 dark:bg-brand-500/10 dark:text-brand-300">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
        <rect x="4" y="11" width="16" height="10" rx="2" />
        <path d="M8 11V7a4 4 0 018 0v4" />
      </svg>
      Anonymized · RA 10173
    </span>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-gray-200 px-6 py-10 text-center dark:border-white/10">
      <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">{title}</p>
      {children && <p className="text-[13px] text-gray-500 dark:text-gray-400">{children}</p>}
    </div>
  );
}

export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 py-6 text-sm text-gray-400 dark:text-gray-500">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      {label}
    </div>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  return <p className="rounded-xl bg-red-50 px-3 py-2 text-[13px] text-red-700 dark:bg-red-500/10 dark:text-red-300">{children}</p>;
}

// ---------------------------------------------------------------------------
// Buttons (smaller than the citizen-side Button, for dense admin screens)
// ---------------------------------------------------------------------------
type SmallVariant = "primary" | "secondary" | "ghost" | "danger";
const smallBase =
  "inline-flex items-center justify-center gap-1.5 rounded-xl px-3.5 py-2 text-[13px] font-semibold transition active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#0a0f0c] disabled:pointer-events-none disabled:opacity-50";
const smallVariants: Record<SmallVariant, string> = {
  primary: "bg-gradient-to-b from-brand-600 to-brand-700 text-white shadow-sm hover:from-brand-500 hover:to-brand-600",
  secondary: "bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50 dark:bg-gray-900 dark:text-gray-200 dark:ring-white/10 dark:hover:bg-gray-800",
  ghost: "bg-transparent text-brand-700 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-white/5",
  danger: "bg-white text-red-700 ring-1 ring-red-200 hover:bg-red-50 dark:bg-gray-900 dark:text-red-300 dark:ring-red-500/30 dark:hover:bg-red-500/10",
};

export function smallButton(variant: SmallVariant = "primary", className = "") {
  return `${smallBase} ${smallVariants[variant]} ${className}`.trim();
}

export function Btn({ variant = "primary", className = "", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: SmallVariant }) {
  return <button type="button" className={smallButton(variant, className)} {...props} />;
}

// ---------------------------------------------------------------------------
// Form fields
// ---------------------------------------------------------------------------
export const inputClass =
  "w-full rounded-xl bg-white px-3 py-2 text-sm text-gray-900 ring-1 ring-gray-200 placeholder:text-gray-400 transition focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-white/[0.04] dark:text-gray-100 dark:ring-white/10 dark:placeholder:text-gray-500";

export function Field({ label, hint, children }: { label: string; hint?: string; children: (id: string) => ReactNode }) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-xs font-semibold text-gray-600 dark:text-gray-300">
        {label}
      </label>
      {children(id)}
      {hint && <p className="text-[11px] text-gray-400 dark:text-gray-500">{hint}</p>}
    </div>
  );
}

export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:opacity-50 dark:focus-visible:ring-offset-[#0a0f0c] ${checked ? "bg-brand-600" : "bg-gray-200 dark:bg-white/15"}`}
    >
      <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition ${checked ? "translate-x-[22px]" : "translate-x-0.5"}`} />
    </button>
  );
}

/** Segmented control, styled like the citizen-side ThemeToggle pill. */
export function Segmented<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; label: string }) {
  return (
    <div role="group" aria-label={label} className="inline-flex flex-wrap rounded-full border border-gray-200/80 bg-white/80 p-0.5 shadow-sm dark:border-white/10 dark:bg-white/5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${value === o.value ? "bg-brand-700 text-white shadow-sm dark:bg-brand-600" : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modal (native <dialog> gives focus trapping + Esc for free)
// ---------------------------------------------------------------------------
export function Modal({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-3xl bg-white p-0 text-gray-900 shadow-2xl ring-1 ring-black/5 backdrop:bg-brand-950/40 backdrop:backdrop-blur-sm dark:bg-[#111814] dark:text-gray-100 dark:ring-white/10"
    >
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-white/10">
        <h2 className="text-[15px] font-semibold">{title}</h2>
        <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/10 dark:hover:text-gray-200">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
      <div className="max-h-[70vh] space-y-4 overflow-y-auto px-5 py-5">{children}</div>
      {footer && <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-4 dark:border-white/10">{footer}</div>}
    </dialog>
  );
}

// ---------------------------------------------------------------------------
// Table wrappers
// ---------------------------------------------------------------------------
export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="-mx-5 overflow-x-auto">
      <table className="w-full min-w-[560px] border-collapse text-left text-[13px]">{children}</table>
    </div>
  );
}
export const th = "border-b border-gray-100 px-5 py-2.5 text-[11px] font-bold uppercase tracking-wide text-gray-400 dark:border-white/10 dark:text-gray-500";
export const td = "border-b border-gray-100 px-5 py-3 align-top text-gray-700 dark:border-white/5 dark:text-gray-300";

// ---------------------------------------------------------------------------
// Formatting + export helpers
// ---------------------------------------------------------------------------
export const fmtNum = (n: number) => n.toLocaleString("en-PH");
export const fmtPct = (n: number, digits = 1) => `${(n * 100).toFixed(digits)}%`;
export const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
export const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-PH", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
export const fmtMonth = (ym: string) => new Date(`${ym}-01T00:00:00`).toLocaleDateString("en-PH", { month: "short", year: "2-digit" });

export function downloadCsv(filename: string, rows: (string | number | boolean | null | undefined)[][]) {
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = rows.map((r) => r.map(esc).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
