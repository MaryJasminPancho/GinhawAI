"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Backdrop from "@/components/Backdrop";
import PageHeader from "@/components/PageHeader";
import { buttonClasses } from "@/components/Button";
import { assess, Assessment, getSession, Lang, SessionExpiredError, Tier } from "@/lib/api";
import { t } from "@/lib/i18n";

// Fig. 18: red = High Risk, amber = Moderate Risk, green = Low Risk.
const LEVELS: Record<Tier, { label: Record<Lang, string>; from: string; to: string; badge: string; dot: string }> = {
  high: {
    label: { fil: "Mataas na pangangailangan", ceb: "Taas nga panginahanglan", en: "High need" },
    from: "#f87171",
    to: "#dc2626",
    badge: "bg-red-100 text-red-800 dark:bg-red-500/10 dark:text-red-300",
    dot: "bg-red-500",
  },
  moderate: {
    label: { fil: "Katamtamang pangangailangan", ceb: "Kasarangang panginahanglan", en: "Moderate need" },
    from: "#f59e0b",
    to: "#d97706",
    badge: "bg-amber-100 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  low: {
    label: { fil: "Mas mababang pangangailangan", ceb: "Ubos nga panginahanglan", en: "Lower need" },
    from: "#4ade80",
    to: "#16a34a",
    badge: "bg-green-100 text-green-800 dark:bg-green-500/10 dark:text-green-300",
    dot: "bg-green-500",
  },
};

const RADIUS = 52;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function ScoreRing({ score, from, to, label }: { score: number; from: string; to: string; label: string }) {
  const pct = Math.min(Math.max(score, 0), 100);
  // Start empty, then animate to the target offset once mounted (fill-in effect).
  const [offset, setOffset] = useState(CIRCUMFERENCE);
  useEffect(() => {
    const t = setTimeout(() => setOffset(CIRCUMFERENCE * (1 - pct / 100)), 80);
    return () => clearTimeout(t);
  }, [pct]);

  return (
    <div className="relative h-48 w-48">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" aria-hidden="true">
        <defs>
          <linearGradient id="scoreRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={from} />
            <stop offset="100%" stopColor={to} />
          </linearGradient>
        </defs>
        <circle cx="60" cy="60" r={RADIUS} fill="none" strokeWidth="9" className="stroke-gray-100 dark:stroke-white/10" />
        <circle
          cx="60"
          cy="60"
          r={RADIUS}
          fill="none"
          strokeWidth="9"
          strokeLinecap="round"
          stroke="url(#scoreRingGrad)"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-5xl font-extrabold tracking-tight">{Math.round(pct)}</span>
        <span className="text-xs font-medium text-gray-400 dark:text-gray-500">{label}</span>
      </div>
    </div>
  );
}

function ScoreInner() {
  const sessionId = useSearchParams().get("session");
  const [lang, setLang] = useState<Lang>("en");
  const [result, setResult] = useState<Assessment | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    getSession(sessionId)
      .then(async (s) => {
        setLang(s.language);
        setResult(s.assessment ?? (await assess(sessionId)));
      })
      .catch((e) => setError(e instanceof SessionExpiredError ? t("en", "sessionEnded") : e.message));
  }, [sessionId]);

  const missingSession = !sessionId;
  const v = result?.vulnerability;
  const level = v ? LEVELS[v.tier] : null;

  return (
    <div className="relative isolate min-h-screen overflow-hidden bg-white dark:bg-[#0a0f0c] sm:flex sm:items-center sm:justify-center sm:p-6 lg:p-10">
      <Backdrop />

      <main className="relative mx-auto flex min-h-screen w-full max-w-md flex-col p-5 text-gray-900 dark:text-gray-100 sm:min-h-0 sm:max-w-lg sm:rounded-4xl sm:bg-white/70 sm:p-8 sm:shadow-2xl sm:shadow-brand-950/10 sm:ring-1 sm:ring-black/5 sm:backdrop-blur-xl dark:sm:bg-white/4 dark:sm:ring-white/10">
        <PageHeader title={t(lang, "resultTitle")} step={4} totalSteps={4} />

        <section className="relative z-10 mt-8 flex flex-col items-center gap-5 rounded-3xl bg-white p-7 text-center shadow-sm ring-1 ring-black/5 dark:bg-white/4 dark:ring-white/10">
          {missingSession && <p className="text-sm text-red-600 dark:text-red-400">{t(lang, "sessionEnded")}</p>}
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          {!missingSession && !error && !v && <p className="text-sm text-gray-400 dark:text-gray-500">{t(lang, "checking")}</p>}
          {v && level && (
            <>
              <ScoreRing score={v.score} from={level.from} to={level.to} label={t(lang, "outOf100")} />
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold ${level.badge}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${level.dot}`} />
                {level.label[lang]}
              </span>
              <p className="text-[14px] leading-relaxed text-gray-600 dark:text-gray-300">{v.message}</p>
            </>
          )}
        </section>

        {v && v.top_factors.length > 0 && (
          <section className="relative z-10 mt-4 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5 dark:bg-white/4 dark:ring-white/10">
            <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500">{t(lang, "whyThisScore")}</h2>
            <ol className="space-y-2.5">
              {v.top_factors.map((f, i) => (
                <li key={i} className="flex gap-3 text-[13px] leading-relaxed text-gray-700 dark:text-gray-300">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[11px] font-bold text-brand-800 dark:bg-brand-500/15 dark:text-brand-300">{i + 1}</span>
                  {f}
                </li>
              ))}
            </ol>
          </section>
        )}

        <p className="relative z-10 mt-4 text-center text-xs leading-relaxed text-gray-400 dark:text-gray-500">{t(lang, "scoreNote")}</p>

        <div className="relative z-10 mt-6 flex flex-col gap-3">
          <Link
            href={`/recommendations?session=${sessionId ?? ""}`}
            aria-disabled={!v}
            className={buttonClasses("primary", `w-full text-center ${!v ? "pointer-events-none opacity-50" : ""}`)}
          >
            {t(lang, "seePrograms")}
          </Link>
          <Link href="/language" className={buttonClasses("secondary", "w-full text-center")}>
            {t(lang, "startOver")}
          </Link>
        </div>
      </main>
    </div>
  );
}

// useSearchParams() must sit inside <Suspense> or `next build` will complain.
export default function ScorePage() {
  return (
    <Suspense fallback={null}>
      <ScoreInner />
    </Suspense>
  );
}