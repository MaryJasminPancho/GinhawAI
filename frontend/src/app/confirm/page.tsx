"use client";

import Image from "next/image";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getSession } from "@/lib/api";

// Friendly names for known fields. Anything not listed is auto-formatted
// (e.g. "monthly_income" -> "Monthly income"), so new backend fields still show up.
const LABELS: Record<string, string> = {
  monthly_income: "Monthly income (₱)",
  number_of_dependents: "Number of dependents",
  is_unemployed: "Currently unemployed",
  has_pwd: "Household member with disability",
};

function formatValue(value: unknown) {
  if (value === true) return "Yes";
  if (value === false) return "No";
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

function labelFor(key: string) {
  if (LABELS[key]) return LABELS[key];
  const text = key.replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function ConfirmInner() {
  const sessionId = useSearchParams().get("session");
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    getSession(sessionId)
      .then((s) => setData(s.state.entities ?? {}))
      .catch((e) => setError(`Could not load your answers. (${e.message})`));
  }, [sessionId]);

  const missingSession = !sessionId;
  const entries = data ? Object.entries(data) : [];

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
          Confirm your answers
        </h1>
      </header>

      <section className="rounded-lg border border-gray-300 bg-white dark:border-gray-700 dark:bg-gray-900">
        {missingSession && (
          <p className="p-4 text-sm text-red-600 dark:text-red-400">
            No session found. Please start over.
          </p>
        )}
        {error && (
          <p className="p-4 text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
        {!missingSession && !error && data === null && (
          <p className="p-4 text-sm text-gray-500 dark:text-gray-400">
            Loading your answers…
          </p>
        )}
        {data !== null && entries.length === 0 && (
          <p className="p-4 text-sm text-gray-500 dark:text-gray-400">
            No answers were collected yet.
          </p>
        )}
        {entries.length > 0 && (
          <dl className="divide-y divide-gray-200 dark:divide-gray-700">
            {entries.map(([key, value]) => (
              <div key={key} className="flex justify-between gap-4 px-4 py-3">
                <dt className="text-sm text-gray-500 dark:text-gray-400">
                  {labelFor(key)}
                </dt>
                <dd className="text-right text-sm font-medium">
                  {formatValue(value)}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </section>

      <div className="mt-6 flex flex-col gap-3">
        <Link
          href={`/score?session=${sessionId ?? ""}`}
          aria-disabled={missingSession}
          className={`rounded-xl bg-green-700 px-6 py-3 text-center font-semibold text-white transition hover:bg-green-800 dark:bg-green-600 dark:hover:bg-green-500 ${
            missingSession ? "pointer-events-none opacity-50" : ""
          }`}
        >
          Yes, this is correct
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
export default function ConfirmPage() {
  return (
    <Suspense fallback={null}>
      <ConfirmInner />
    </Suspense>
  );
}