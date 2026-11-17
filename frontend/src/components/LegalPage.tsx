"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Backdrop from "@/components/Backdrop";
import PageHeader from "@/components/PageHeader";
import SiteFooter from "@/components/SiteFooter";
import { LANG_LABELS } from "@/lib/i18n";
import type { Lang } from "@/lib/api";
import { LEGAL, LEGAL_LABELS, LEGAL_UPDATED, PRIVACY_CONTACT } from "@/lib/legal";

// Shared layout for the Privacy Notice and the Terms of Use: numbered sections in plain
// language, a language switch (the three languages of the app), and the site footer.

function LegalInner({ kind }: { kind: "privacy" | "terms" }) {
  const fromUrl = useSearchParams().get("lang");
  const [lang, setLang] = useState<Lang>(fromUrl === "fil" || fromUrl === "ceb" ? fromUrl : "en");
  const doc = LEGAL[kind][lang];
  const labels = LEGAL_LABELS[lang];

  return (
    <div className="relative isolate min-h-screen overflow-hidden bg-white dark:bg-[#0a0f0c] sm:flex sm:items-center sm:justify-center sm:p-6 lg:p-10">
      <Backdrop />
      <main className="relative mx-auto flex min-h-screen w-full max-w-md flex-col p-5 text-gray-900 dark:text-gray-100 sm:min-h-0 sm:max-w-2xl sm:rounded-4xl sm:bg-white/80 sm:p-8 sm:shadow-2xl sm:shadow-brand-900/15 sm:ring-1 sm:ring-black/5 sm:backdrop-blur-xl dark:sm:bg-white/4 dark:sm:ring-white/10">
        <PageHeader title={doc.title} />

        {/* Language switch: older readers can read it in the language they chose */}
        <div role="group" aria-label="Language" className="relative z-10 mt-5 inline-flex self-start rounded-full bg-gray-100 p-0.5 text-xs font-semibold dark:bg-white/10">
          {(["fil", "ceb", "en"] as const).map((l) => (
            <button
              key={l}
              type="button"
              aria-pressed={lang === l}
              onClick={() => setLang(l)}
              className={`rounded-full px-3.5 py-2 ${lang === l ? "bg-white text-brand-800 shadow-sm dark:bg-white/15 dark:text-white" : "text-gray-500 dark:text-gray-400"}`}
            >
              {LANG_LABELS[l]}
            </button>
          ))}
        </div>

        <article className="relative z-10 mt-5">
          <h1 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">{doc.title}</h1>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {labels.updated}: {LEGAL_UPDATED}
          </p>
          <p className="mt-3 text-[0.9375rem] leading-relaxed text-gray-700 dark:text-gray-300">{doc.intro}</p>

          <div className="mt-5 space-y-5">
            {doc.sections.map((s, i) => (
              <section key={s.h}>
                <h2 className="text-[1rem] font-semibold text-gray-900 dark:text-white">
                  {i + 1}. {s.h}
                </h2>
                {s.p && <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-gray-700 dark:text-gray-300">{s.p}</p>}
                {s.items && (
                  <ul className="mt-1.5 list-disc space-y-1 pl-5 text-[0.9375rem] leading-relaxed text-gray-700 dark:text-gray-300">
                    {s.items.map((it) => (
                      <li key={it}>{it}</li>
                    ))}
                  </ul>
                )}
                {s.after && <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-gray-700 dark:text-gray-300">{s.after}</p>}
              </section>
            ))}
          </div>

          {/* Shown only once the LGU names a contact (see PRIVACY_CONTACT in lib/legal.ts) */}
          {kind === "privacy" && PRIVACY_CONTACT && (
            <p className="mt-5 rounded-2xl bg-brand-50 px-4 py-3 text-[0.875rem] text-brand-900 ring-1 ring-brand-200 dark:bg-brand-500/10 dark:text-brand-200 dark:ring-brand-500/20">
              <span className="font-semibold">{labels.contact}:</span> {PRIVACY_CONTACT}
            </p>
          )}
        </article>

        {/* "replace": switching between Privacy and Terms does not add history entries, so Back leaves them */}
        <SiteFooter lang={lang} className="mt-8" replace />
      </main>
    </div>
  );
}

export default function LegalPage({ kind }: { kind: "privacy" | "terms" }) {
  return (
    <Suspense fallback={null}>
      <LegalInner kind={kind} />
    </Suspense>
  );
}
