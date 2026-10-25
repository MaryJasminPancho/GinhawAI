"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Backdrop from "@/components/Backdrop";
import PageHeader from "@/components/PageHeader";
import { buttonClasses } from "@/components/Button";
import { Catalog, CatalogProgram, getCatalog, Lang } from "@/lib/api";
import { LANG_LABELS, t } from "@/lib/i18n";

// "Search Hyperlocal Assistance Programs" (Appendix R #36): browse and search every
// active program without doing the assessment chat. Nothing about the citizen
// is asked or stored on this page.

const LANGS: Lang[] = ["fil", "ceb", "en"];

function BrowseInner() {
  const param = useSearchParams().get("lang");
  const [lang, setLang] = useState<Lang>(param === "fil" || param === "ceb" ? param : "en");
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [barangay, setBarangay] = useState("");

  useEffect(() => {
    getCatalog(lang).then(setCatalog).catch((e) => setError(e.message));
  }, [lang]);

  function chooseLang(l: Lang) {
    setLang(l);
    const url = new URL(window.location.href);
    url.searchParams.set("lang", l);
    window.history.replaceState(null, "", url);
  }

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!catalog) return [];
    if (!q) return catalog.programs;
    return catalog.programs.filter((p) =>
      [p.program_name, p.agency, p.scope ?? "", ...p.documents.map((d) => d.document_name), ...p.who_can_apply.map((c) => c.label)]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [catalog, query]);

  // "Where to go": city-wide offices for everyone; a barangay hall only once the citizen
  // picks that barangay (other barangays' halls only serve their own residents).
  const offices = useMemo(() => {
    if (!catalog) return [];
    return catalog.offices
      .filter((o) => !o.is_barangay_hall || (barangay && o.barangay_code === barangay))
      .sort((a, b) => Number(b.barangay_code === barangay && !!barangay) - Number(a.barangay_code === barangay && !!barangay));
  }, [catalog, barangay]);
  const hallListed = !!barangay && offices.some((o) => o.is_barangay_hall);

  return (
    <div className="relative isolate min-h-screen overflow-hidden bg-white dark:bg-[#0a0f0c] sm:flex sm:items-center sm:justify-center sm:p-6 lg:p-10">
      <Backdrop />
      <main className="relative mx-auto flex min-h-screen w-full max-w-md flex-col p-5 text-gray-900 dark:text-gray-100 sm:min-h-0 sm:max-w-2xl lg:max-w-5xl sm:rounded-4xl sm:bg-white/80 sm:p-8 sm:shadow-2xl sm:shadow-brand-900/15 sm:ring-1 sm:ring-black/5 sm:backdrop-blur-xl dark:sm:bg-white/4 dark:sm:ring-white/10">
        <PageHeader title={t(lang, "browseTitle")} subtitle={LANG_LABELS[lang]} />

        <div className="relative z-10 mt-5 space-y-3">
          <div role="group" aria-label="Language" className="flex gap-1.5">
            {LANGS.map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => chooseLang(l)}
                aria-pressed={lang === l}
                className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${lang === l ? "bg-brand-600 text-white ring-brand-600" : "text-gray-600 ring-gray-200 hover:bg-gray-50 dark:text-gray-300 dark:ring-white/10 dark:hover:bg-white/5"}`}
              >
                {LANG_LABELS[l]}
              </button>
            ))}
          </div>
          <p className="text-[0.8125rem] leading-relaxed text-gray-500 dark:text-gray-400">{t(lang, "browseHint")}</p>
          <input
            type="search"
            aria-label={t(lang, "searchPrograms")}
            placeholder={t(lang, "searchPrograms")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-full bg-white px-4 py-2.5 text-[0.875rem] text-gray-900 ring-1 ring-gray-200 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-white/4 dark:text-gray-100 dark:ring-white/10"
          />
        </div>

        <div className="relative z-10 mt-4 space-y-3 lg:grid lg:grid-cols-2 lg:items-start lg:gap-3 lg:space-y-0">
          {error && <p className="lg:col-span-2 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</p>}
          {!catalog && !error && <p className="text-sm text-gray-400 lg:col-span-2">{t(lang, "loading")}</p>}
          {catalog && shown.length === 0 && <p className="text-sm text-gray-500 lg:col-span-2 dark:text-gray-400">{t(lang, "noMatch")}</p>}
          {shown.map((p) => (
            <ProgramDetails key={p.program_id} p={p} lang={lang} />
          ))}
        </div>

        {catalog && catalog.partners.length > 0 && (
          <section className="relative z-10 mt-6">
            <h2 className="text-xs font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500">{t(lang, "communityTitle")}</h2>
            <p className="mb-2 mt-1 text-xs text-gray-500 dark:text-gray-400">{t(lang, "communityHint")}</p>
            <ul className="space-y-2 lg:grid lg:grid-cols-2 lg:gap-2 lg:space-y-0">
              {catalog.partners.map((o) => (
                <li key={o.name} className="rounded-2xl bg-white p-3.5 text-[0.8125rem] shadow-sm ring-1 ring-black/5 dark:bg-white/4 dark:ring-white/10">
                  <p className="font-semibold text-gray-900 dark:text-white">{o.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{[o.org_type, o.barangay_name && `Brgy. ${o.barangay_name}`].filter(Boolean).join(" · ")}</p>
                  {o.services && <p className="mt-1 text-gray-700 dark:text-gray-300">{o.services}</p>}
                  {o.resources.length > 0 && (
                    <ul className="mt-2 space-y-1.5 border-t border-gray-100 pt-2 dark:border-white/10">
                      {o.resources.map((r, i) => (
                        <li key={i}>
                          <span className="font-medium text-gray-800 dark:text-gray-200">{r.title}</span>
                          <span className="block text-xs text-gray-500 dark:text-gray-400">
                            {[r.starts_on && (r.ends_on && r.ends_on !== r.starts_on ? `${r.starts_on} – ${r.ends_on}` : r.starts_on), r.barangay_name && `Brgy. ${r.barangay_name}`, r.details].filter(Boolean).join(" · ")}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {(o.address || o.contact) && <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{[o.address, o.contact].filter(Boolean).join(" · ")}</p>}
                </li>
              ))}
            </ul>
          </section>
        )}

        {catalog && (
          <section className="relative z-10 mt-6">
            <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500">{t(lang, "officesTitle")}</h2>
            <label htmlFor="where-barangay" className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">
              {t(lang, "yourBarangay")}
            </label>
            <select
              id="where-barangay"
              value={barangay}
              onChange={(e) => setBarangay(e.target.value)}
              className="mb-2 w-full rounded-xl bg-white px-3 py-2.5 text-sm text-gray-900 ring-1 ring-black/10 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-white/5 dark:text-white dark:ring-white/15"
            >
              <option value="">{t(lang, "chooseBarangay")}</option>
              {catalog.barangays.map((b) => (
                <option key={b.barangay_code} value={b.barangay_code}>
                  {b.barangay_name}
                </option>
              ))}
            </select>
            {!hallListed && <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">{t(lang, barangay ? "hallNotListed" : "pickBarangayHint")}</p>}
            <ul className="space-y-2 lg:grid lg:grid-cols-3 lg:gap-2 lg:space-y-0">
              {offices.map((o) => (
                <li key={o.office_name} className="rounded-2xl bg-white p-3.5 text-[0.8125rem] shadow-sm ring-1 ring-black/5 dark:bg-white/4 dark:ring-white/10">
                  <p className="font-semibold text-gray-900 dark:text-white">{o.office_name}</p>
                  {o.address && <p className="mt-0.5 text-gray-600 dark:text-gray-300">{o.address}</p>}
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{[o.operating_hours, o.contact_number].filter(Boolean).join(" · ")}</p>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="relative z-10 mt-6 flex flex-col gap-2">
          <Link href={`/chat?lang=${lang}`} className={buttonClasses("primary", "w-full text-center")}>
            {t(lang, "checkIfQualify")}
          </Link>
          <p className="text-center text-xs text-gray-400 dark:text-gray-500">{t(lang, "disclaimer")}</p>
        </div>
      </main>
    </div>
  );
}

function ProgramDetails({ p, lang }: { p: CatalogProgram; lang: Lang }) {
  return (
    <details className="group overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5 dark:bg-white/4 dark:ring-white/10">
      <summary className="flex cursor-pointer list-none items-start justify-between gap-3 p-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
        <div className="min-w-0">
          <h2 className="text-[0.9375rem] font-semibold leading-snug text-gray-900 dark:text-white">{p.program_name}</h2>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{[p.agency, p.scope].filter(Boolean).join(" · ")}</p>
        </div>
        <svg className="mt-1 shrink-0 text-gray-300 transition group-open:rotate-180 dark:text-gray-600" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </summary>
      <div className="space-y-4 border-t border-gray-100 px-4 py-4 text-[0.8125rem] dark:border-white/10">
        {p.who_can_apply.length > 0 && (
          <div>
            <h3 className="mb-1.5 text-xs font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500">{t(lang, "whoCanApply")}</h3>
            <ul className="space-y-1">
              {p.who_can_apply.map((c, i) => (
                <li key={i} className="text-gray-700 dark:text-gray-300">
                  <span className="font-medium">{c.label}:</span> {c.requirement}
                </li>
              ))}
            </ul>
          </div>
        )}
        {p.documents.length > 0 && (
          <div>
            <h3 className="mb-1.5 text-xs font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500">{t(lang, "documentsTitle")}</h3>
            <ul className="space-y-2">
              {p.documents.map((d, i) => (
                <li key={i}>
                  <p className="flex flex-wrap items-center gap-1.5 font-medium text-gray-800 dark:text-gray-200">
                    {d.document_name}
                    <span className={`rounded-full px-1.5 py-px text-[0.625rem] font-semibold ${d.is_mandatory ? "bg-brand-100 text-brand-800 dark:bg-brand-500/15 dark:text-brand-300" : "bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300"}`}>
                      {t(lang, d.is_mandatory ? "required" : "optional")}
                    </span>
                    {d.only_if && <span className="rounded-full bg-amber-100 px-1.5 py-px text-[0.625rem] font-semibold text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">{t(lang, "onlyIf")}: {d.only_if}</span>}
                  </p>
                  {d.notes && <p className="text-xs text-gray-500 dark:text-gray-400">{d.notes}</p>}
                </li>
              ))}
            </ul>
          </div>
        )}
        {p.schedules.length > 0 && (
          <div>
            <h3 className="mb-1.5 text-xs font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500">{t(lang, "schedulesTitle")}</h3>
            <ul className="space-y-1.5">
              {p.schedules.map((s, i) => (
                <li key={i} className="text-gray-700 dark:text-gray-300">
                  <span className="font-medium">{s.start_date === s.end_date ? s.start_date : `${s.start_date} – ${s.end_date}`}</span> · {s.office_name}
                  {s.notes && <span className="block text-xs text-gray-500 dark:text-gray-400">{s.notes}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </details>
  );
}

// useSearchParams() must sit inside <Suspense> or `next build` will complain.
export default function ProgramsPage() {
  return (
    <Suspense fallback={null}>
      <BrowseInner />
    </Suspense>
  );
}
