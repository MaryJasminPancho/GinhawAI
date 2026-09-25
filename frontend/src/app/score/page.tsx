"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Backdrop from "@/components/Backdrop";
import PageHeader from "@/components/PageHeader";
import { buttonClasses } from "@/components/Button";
import { getSession } from "@/lib/api";

// CHECK: these cut-offs and colors are placeholders. Ask Jasmin what the real bands are.
function levelFor(score: number) {
  if (score >= 67)
    return {
      label: "High need",
      from: "#f87171",
      to: "#dc2626",
      badge: "bg-red-100 text-red-800 dark:bg-red-500/10 dark:text-red-300",
      dot: "bg-red-500",
      message: "Based on your answers, your household may benefit from support right away.",
    };
  if (score >= 34)
    return {
      label: "Moderate need",
      from: "#f59e0b",
      to: "#d97706",
      badge: "bg-amber-100 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300",
      dot: "bg-amber-500",
      message: "Based on your answers, your household may qualify for some support programs.",
    };
  return {
    label: "Lower need",
    from: "#4ade80",
    to: "#16a34a",
    badge: "bg-green-100 text-green-800 dark:bg-green-500/10 dark:text-green-300",
    dot: "bg-green-500",
    message:
      "Based on your answers, your household's need looks lower right now, but you can still check available programs.",
  };
}

const RADIUS = 52;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function ScoreRing({ score, from, to }: { score: number; from: string; to: string }) {
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
        <span className="text-xs font-medium text-gray-400 dark:text-gray-500">out of 100</span>
      </div>
    </div>
  );
}

function ScoreInner() {
  const sessionId = useSearchParams().get("session");
  const [score, setScore] = useState<number | null | undefined>(undefined); // undefined = loading
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    getSession(sessionId)
      .then((s) => setScore(s.vulnerability_score ?? null))
      .catch((e) => setError(`Could not load your score. (${e.message})`));
  }, [sessionId]);

  const missingSession = !sessionId;
  const level = typeof score === "number" ? levelFor(score) : null;

  return (
    <div className="relative isolate min-h-screen overflow-hidden bg-white dark:bg-[#0a0f0c] sm:flex sm:items-center sm:justify-center sm:p-6 lg:p-10">
      <Backdrop />

      <main className="relative mx-auto flex min-h-screen w-full max-w-md flex-col p-5 text-gray-900 dark:text-gray-100 sm:min-h-0 sm:max-w-lg sm:rounded-[32px] sm:bg-white/70 sm:p-8 sm:shadow-2xl sm:shadow-brand-950/10 sm:ring-1 sm:ring-black/5 sm:backdrop-blur-xl dark:sm:bg-white/[0.04] dark:sm:ring-white/10">
        <PageHeader title="Your result" step={4} totalSteps={4} />

        <section className="relative z-10 mt-8 flex flex-col items-center gap-5 rounded-3xl bg-white p-7 text-center shadow-sm ring-1 ring-black/5 dark:bg-white/[0.04] dark:ring-white/10">
          {missingSession && (
            <p className="text-sm text-red-600 dark:text-red-400">No session found. Please start over.</p>
          )}
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          {!missingSession && !error && score === undefined && (
            <p className="text-sm text-gray-400 dark:text-gray-500">Calculating your score…</p>
          )}
          {score === null && (
            <p className="text-sm text-gray-400 dark:text-gray-500">
              Your score isn&apos;t available yet. Please try again in a moment.
            </p>
          )}
          {typeof score === "number" && level && (
            <>
              <ScoreRing score={score} from={level.from} to={level.to} />
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold ${level.badge}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${level.dot}`} />
                {level.label}
              </span>
              <p className="text-[14px] leading-relaxed text-gray-600 dark:text-gray-300">{level.message}</p>
            </>
          )}
        </section>

        <p className="relative z-10 mt-4 text-center text-xs leading-relaxed text-gray-400 dark:text-gray-500">
          This score is an estimate used to suggest programs. It is not an official decision — your LGU office confirms eligibility.
        </p>

        <div className="relative z-10 mt-6 flex flex-col gap-3">
          <Link
            href={`/recommendations?session=${sessionId ?? ""}`}
            aria-disabled={typeof score !== "number"}
            className={buttonClasses(
              "primary",
              `w-full text-center ${typeof score !== "number" ? "pointer-events-none opacity-50" : ""}`
            )}
          >
            See recommended programs
          </Link>
          <Link href="/language" className={buttonClasses("secondary", "w-full text-center")}>
            Start over
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