"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Backdrop from "@/components/Backdrop";
import PageHeader from "@/components/PageHeader";
import { buttonClasses } from "@/components/Button";
import { getSession } from "@/lib/api";

// Friendly names for known fields. Anything not listed is auto-formatted
// (e.g. "monthly_income" -> "Monthly income"), so new backend fields still show up.
// CHECK: update the keys to match the backend's real field names.
const LABELS: Record<string, string> = {
  full_name: "Full name",
  barangay: "Barangay",
  household_size: "Household size",
  monthly_income: "Monthly income (₱)",
};

function labelFor(key: string) {
  if (LABELS[key]) return LABELS[key];
  const text = key.replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function ErrorNotice({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 p-4 text-sm text-red-700 dark:text-red-300">
      <svg className="mt-0.5 h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 8v5M12 16h.01" />
      </svg>
      <span>{children}</span>
    </div>
  );
}

function ConfirmInner() {
  const sessionId = useSearchParams().get("session");
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    getSession(sessionId)
      .then((s) => setData(s.extracted_data ?? {}))
      .catch((e) => setError(`Could not load your answers. (${e.message})`));
  }, [sessionId]);

  const missingSession = !sessionId;
  const entries = data ? Object.entries(data) : [];

  return (
    <div className="relative isolate min-h-screen overflow-hidden bg-white dark:bg-[#0a0f0c] sm:flex sm:items-center sm:justify-center sm:p-6 lg:p-10">
      <Backdrop />

      <main className="relative mx-auto flex min-h-screen w-full max-w-md flex-col p-5 text-gray-900 dark:text-gray-100 sm:min-h-0 sm:max-w-lg sm:rounded-[32px] sm:bg-white/70 sm:p-8 sm:shadow-2xl sm:shadow-brand-950/10 sm:ring-1 sm:ring-black/5 sm:backdrop-blur-xl dark:sm:bg-white/[0.04] dark:sm:ring-white/10">
        <PageHeader title="Confirm your answers" step={3} totalSteps={4} />

        <section className="relative z-10 mt-6 overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-black/5 dark:bg-white/[0.04] dark:ring-white/10">
          {missingSession && <ErrorNotice>No session found. Please start over.</ErrorNotice>}
          {error && <ErrorNotice>{error}</ErrorNotice>}
          {!missingSession && !error && data === null && (
            <p className="p-4 text-sm text-gray-400 dark:text-gray-500">Loading your answers…</p>
          )}
          {data !== null && entries.length === 0 && (
            <p className="p-4 text-sm text-gray-400 dark:text-gray-500">
              No answers were collected yet.
            </p>
          )}
          {entries.length > 0 && (
            <dl className="divide-y divide-gray-100 dark:divide-white/10">
              {entries.map(([key, value]) => (
                <div key={key} className="flex justify-between gap-4 px-5 py-3.5">
                  <dt className="text-sm text-gray-400 dark:text-gray-500">{labelFor(key)}</dt>
                  <dd className="text-right text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {String(value ?? "—")}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </section>

        <div className="relative z-10 mt-6 flex flex-col gap-3">
          <Link
            href={`/score?session=${sessionId ?? ""}`}
            aria-disabled={missingSession}
            className={buttonClasses(
              "primary",
              `w-full text-center ${missingSession ? "pointer-events-none opacity-50" : ""}`
            )}
          >
            Yes, this is correct
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
export default function ConfirmPage() {
  return (
    <Suspense fallback={null}>
      <ConfirmInner />
    </Suspense>
  );
}