"use client";

import Image from "next/image";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getSession } from "@/lib/api";

// CHECK: these cut-offs are placeholders. Ask Jasmin what the real bands are.
function levelFor(score: number) {
  if (score >= 67)
    return {
      label: "High need",
      ring: "stroke-red-600 dark:stroke-red-400",
      badge: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
      message: "Based on your answers, your household may benefit from support right away.",
    };
  if (score >= 34)
    return {
      label: "Moderate need",
      ring: "stroke-amber-500 dark:stroke-amber-400",
      badge: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
      message: "Based on your answers, your household may qualify for some support programs.",
    };
  return {
    label: "Lower need",
    ring: "stroke-green-600 dark:stroke-green-400",
    badge: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
    message: "Based on your answers, your household's need looks lower right now, but you can still check available programs.",
  };
}

const RADIUS = 54;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function ScoreRing({ score, ringClass }: { score: number; ringClass: string }) {
  const pct = Math.min(Math.max(score, 0), 100);
  return (
    <div className="relative h-48 w-48">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" aria-hidden="true">
        <circle
          cx="60"
          cy="60"
          r={RADIUS}
          fill="none"
          strokeWidth="10"
          className="stroke-gray-200 dark:stroke-gray-700"
        />
        <circle
          cx="60"
          cy="60"
          r={RADIUS}
          fill="none"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - pct / 100)}
          className={ringClass}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-5xl font-bold">{Math.round(pct)}</span>
        <span className="text-sm text-gray-500 dark:text-gray-400">out of 100</span>
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
    <main className="mx-auto flex min-h-screen max-w-md flex-col p-4 text-gray-900 dark:text-gray-100">
      <header className="mb-6 flex items-center gap-3">
        <div className="rounded-lg bg-white p-1 shadow-sm">
          <Image
            src="/logo.png"
            alt="GinhawAI"
            width={243}
            height={313}
            priority
            className="h-14 w-auto"
          />
        </div>
        <h1 className="text-xl font-semibold text-green-800 dark:text-green-400">
          Your assessment result
        </h1>
      </header>

      <section className="flex flex-col items-center gap-4 rounded-lg border border-gray-300 bg-white p-6 text-center dark:border-gray-700 dark:bg-gray-900">
        {missingSession && (
          <p className="text-sm text-red-600 dark:text-red-400">
            No session found. Please start over.
          </p>
        )}
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        {!missingSession && !error && score === undefined && (
          <p className="text-sm text-gray-500 dark:text-gray-400">Calculating your score…</p>
        )}
        {score === null && (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Your score isn&apos;t available yet. Please try again in a moment.
          </p>
        )}
        {typeof score === "number" && level && (
          <>
            <ScoreRing score={score} ringClass={level.ring} />
            <span className={`rounded-full px-3 py-1 text-sm font-semibold ${level.badge}`}>
              {level.label}
            </span>
            <p className="text-sm text-gray-700 dark:text-gray-300">{level.message}</p>
          </>
        )}
      </section>

      <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
        This score is an estimate used to suggest programs. It is not an official
        decision, and your LGU office confirms eligibility.
      </p>

      <div className="mt-6 flex flex-col gap-3">
        <Link
          href={`/recommendations?session=${sessionId ?? ""}`}
          aria-disabled={typeof score !== "number"}
          className={`rounded-xl bg-green-700 px-6 py-3 text-center font-semibold text-white transition hover:bg-green-800 dark:bg-green-600 dark:hover:bg-green-500 ${
            typeof score !== "number" ? "pointer-events-none opacity-50" : ""
          }`}
        >
          See recommended programs
        </Link>
        <Link
          href="/language"
          className="rounded-xl border border-gray-300 px-6 py-3 text-center font-medium transition hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
        >
          Start over
        </Link>
      </div>
    </main>
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