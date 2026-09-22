"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
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

function DetailList({ title, items }: { title: string; items: ListItem[] }) {
  return (
    <div>
      <h3 className="mb-1 text-sm font-semibold">{title}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Nothing listed.</p>
      ) : (
        <ul className="list-disc space-y-1 pl-5 text-sm text-gray-700 dark:text-gray-300">
          {items.map((it, i) => (
            <li key={i}>{asText(it)}</li>
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
      className="group rounded-lg border border-gray-300 bg-white dark:border-gray-700 dark:bg-gray-900"
    >
      <summary className="cursor-pointer list-none rounded-lg p-4 focus:outline-none focus:ring-2 focus:ring-green-600">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold text-green-800 dark:text-green-400">
              {program.name}
            </h2>
            {program.description && (
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                {program.description}
              </p>
            )}
          </div>
          <span
            aria-hidden="true"
            className="mt-1 text-gray-400 transition group-open:rotate-180"
          >
            ▾
          </span>
        </div>
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          Tap to see requirements
        </p>
      </summary>

      <div className="space-y-4 border-t border-gray-200 p-4 dark:border-gray-700">
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        {!error && (!eligibility || !documents) && (
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>
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
          Programs for you
        </h1>
      </header>

      <div className="space-y-3">
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        {!error && programs === null && (
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading programs…</p>
        )}
        {programs?.length === 0 && (
          <p className="text-sm text-gray-500 dark:text-gray-400">No programs found.</p>
        )}
        {programs?.map((p) => (
          <ProgramCard key={p.program_id} program={p} />
        ))}
      </div>

      <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
        Final eligibility is confirmed by your LGU office. Bring the listed
        documents when you visit.
      </p>

      <Link
        href="/language"
        className="mt-6 rounded-xl border border-gray-300 px-6 py-3 text-center font-medium transition hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
      >
        Start over
      </Link>
    </main>
  );
}