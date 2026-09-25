"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Backdrop from "@/components/Backdrop";
import PageHeader from "@/components/PageHeader";
import { buttonClasses } from "@/components/Button";
import {
  getProgramDocuments,
  getProgramEligibility,
  getPrograms,
  type ListItem,
  type Program,
} from "@/lib/api";

// Rows from the backend may be strings or objects. Show the first text-like field.
// CHECK: once you know the real field name, simplify this.
function asText(item: ListItem): string {
  if (typeof item === "string") return item;
  for (const key of ["description", "criteria", "requirement", "document_name", "name", "title"]) {
    const v = item[key];
    if (typeof v === "string" && v) return v;
  }
  return JSON.stringify(item);
}

function ProgramIcon() {
  return (
    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 2l3 6 6 .9-4.5 4.3 1 6.3L12 16.9 6.5 19.5l1-6.3L3 8.9 9 8l3-6z" />
      </svg>
    </div>
  );
}

function ChevronDown() {
  return (
    <svg
      className="mt-1 shrink-0 text-gray-300 transition group-open:rotate-180 dark:text-gray-600"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.3"
      aria-hidden="true"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function DetailList({ title, items }: { title: string; items: ListItem[] }) {
  return (
    <div>
      <h3 className="mb-1.5 text-xs font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500">
        {title}
      </h3>
      {items.length === 0 ? (
        <p className="text-[13px] text-gray-400 dark:text-gray-500">Nothing listed.</p>
      ) : (
        <ul className="space-y-1.5 text-[13px] text-gray-600 dark:text-gray-300">
          {items.map((it, i) => (
            <li key={i} className="flex gap-2">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-brand-500" />
              {asText(it)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ProgramCard({ program }: { program: Program }) {
  const [eligibility, setEligibility] = useState<ListItem[] | null>(null);
  const [documents, setDocuments] = useState<ListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load the details the first time the card is opened.
  function handleToggle(e: React.SyntheticEvent<HTMLDetailsElement>) {
    if (!e.currentTarget.open || eligibility || documents) return;
    Promise.all([
      getProgramEligibility(program.program_id),
      getProgramDocuments(program.program_id),
    ])
      .then(([el, docs]) => {
        setEligibility(el);
        setDocuments(docs);
      })
      .catch((err) => setError(`Could not load details. (${err.message})`));
  }

  return (
    <details
      onToggle={handleToggle}
      className="group overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5 open:ring-brand-300 dark:bg-white/[0.04] dark:ring-white/10 dark:open:ring-brand-500/40"
    >
      <summary className="flex cursor-pointer list-none items-start justify-between gap-3 p-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
        <div className="flex gap-3">
          <ProgramIcon />
          <div>
            <h2 className="text-[15px] font-semibold text-gray-900 dark:text-white">{program.name}</h2>
            {program.description && (
              <p className="mt-0.5 text-[13px] leading-relaxed text-gray-500 dark:text-gray-400">
                {program.description}
              </p>
            )}
          </div>
        </div>
        <ChevronDown />
      </summary>

      <div className="space-y-4 border-t border-gray-100 px-4 py-4 dark:border-white/10">
        {error && <p className="text-[13px] text-red-600 dark:text-red-400">{error}</p>}
        {!error && (!eligibility || !documents) && (
          <p className="text-[13px] text-gray-400 dark:text-gray-500">Loading…</p>
        )}
        {eligibility && documents && (
          <>
            <DetailList title="Who can apply" items={eligibility} />
            <DetailList title="Documents to bring" items={documents} />
          </>
        )}
      </div>
    </details>
  );
}

export default function RecommendationsPage() {
  const [programs, setPrograms] = useState<Program[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getPrograms()
      .then(setPrograms)
      .catch((e) => setError(`Could not load programs. Is the backend running? (${e.message})`));
  }, []);

  return (
    <div className="relative isolate min-h-screen overflow-hidden bg-white dark:bg-[#0a0f0c] sm:flex sm:items-center sm:justify-center sm:p-6 lg:p-10">
      <Backdrop />

      <main className="relative mx-auto flex min-h-screen w-full max-w-md flex-col p-5 text-gray-900 dark:text-gray-100 sm:min-h-0 sm:max-w-lg sm:rounded-[32px] sm:bg-white/70 sm:p-8 sm:shadow-2xl sm:shadow-brand-950/10 sm:ring-1 sm:ring-black/5 sm:backdrop-blur-xl dark:sm:bg-white/[0.04] dark:sm:ring-white/10">
        <PageHeader title="Programs for you" subtitle="Based on your assessment" />

        <div className="relative z-10 mt-6 space-y-3">
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          {!error && programs === null && (
            <p className="text-sm text-gray-400 dark:text-gray-500">Loading programs…</p>
          )}
          {programs?.length === 0 && (
            <p className="text-sm text-gray-400 dark:text-gray-500">No programs found.</p>
          )}
          {programs?.map((p) => (
            <ProgramCard key={p.program_id} program={p} />
          ))}
        </div>

        <p className="relative z-10 mt-4 text-xs leading-relaxed text-gray-400 dark:text-gray-500">
          Final eligibility is confirmed by your LGU office. Bring the listed documents when you visit.
        </p>

        <Link href="/language" className={buttonClasses("secondary", "relative z-10 mt-6 w-full text-center")}>
          Start over
        </Link>
      </main>
    </div>
  );
}