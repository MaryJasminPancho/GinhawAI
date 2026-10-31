"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Backdrop from "@/components/Backdrop";
import PageHeader from "@/components/PageHeader";
import Button, { buttonClasses } from "@/components/Button";
import UrgentHelp from "@/components/UrgentHelp";
import { ActionPlan, getPlan, getSession, haveKey, Lang, SessionExpiredError } from "@/lib/api";
import { t } from "@/lib/i18n";

// "My Action Plan" (2nd consultation: the result must not end with "That's all?"): for each
// program the household can or may apply for, the documents to get (and how), where to go,
// what happens there, and upcoming dates. Printable / save as PDF.

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-700 text-[0.875rem] font-bold text-white shadow-sm">{n}</span>
      <div className="min-w-0 flex-1 pb-1">
        <h3 className="text-[0.9375rem] font-semibold text-gray-900 dark:text-white">{title}</h3>
        <div className="mt-1.5 text-[0.875rem] leading-relaxed text-gray-700 dark:text-gray-300">{children}</div>
      </div>
    </li>
  );
}

function PlanInner() {
  const sessionId = useSearchParams().get("session");
  const [lang, setLang] = useState<Lang>("en");
  const [plan, setPlan] = useState<ActionPlan | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    let have: string[] = [];
    try {
      have = JSON.parse(sessionStorage.getItem(haveKey(sessionId)) || "[]");
    } catch {
      // nothing ticked, or storage blocked
    }
    getSession(sessionId)
      .then((s) => {
        setLang(s.language);
        return getPlan(sessionId, have);
      })
      .then(setPlan)
      .catch((e) => setError(e instanceof SessionExpiredError ? t("en", "sessionEnded") : e.message));
  }, [sessionId]);

  return (
    <div className="relative isolate min-h-screen overflow-hidden bg-white dark:bg-[#0a0f0c] sm:flex sm:items-center sm:justify-center sm:p-6 lg:p-10 print:bg-white">
      <Backdrop />
      <main className="relative mx-auto flex min-h-screen w-full max-w-md flex-col p-5 text-gray-900 dark:text-gray-100 sm:min-h-0 sm:max-w-2xl sm:rounded-4xl sm:bg-white/80 sm:p-8 sm:shadow-2xl sm:shadow-brand-900/15 sm:ring-1 sm:ring-black/5 sm:backdrop-blur-xl dark:sm:bg-white/4 dark:sm:ring-white/10">
        <PageHeader title={t(lang, "planTitle")} back={sessionId ? `/recommendations?session=${sessionId}` : "/"} />

        <p className="relative z-10 mt-5 text-[0.9375rem] leading-relaxed text-gray-600 dark:text-gray-300">{t(lang, "planIntro")}</p>

        {!sessionId && <p className="relative z-10 mt-4 text-sm text-red-600 dark:text-red-400">{t(lang, "sessionEnded")}</p>}
        {error && <p className="relative z-10 mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</p>}
        {sessionId && !plan && !error && <p className="relative z-10 mt-6 text-sm text-gray-400">{t(lang, "loading")}</p>}

        {plan && (
          <div className="relative z-10 mt-5 space-y-5">
            <UrgentHelp title={plan.urgent_title} contacts={plan.urgent} />

            {plan.programs.length === 0 && (
              <p className="rounded-2xl bg-amber-50 p-4 text-[0.875rem] leading-relaxed text-amber-900 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-500/20">{t(lang, "noPrograms")}</p>
            )}

            {plan.programs.map((p) => (
              <section key={p.program_id} className="break-inside-avoid rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5 dark:bg-white/4 dark:ring-white/10">
                <h2 className="text-[1.0625rem] font-bold leading-snug">{p.program_name}</h2>
                <ol className="mt-4 space-y-4">
                  <Step n={1} title={plan.labels.docs}>
                    {p.all_documents_ready ? (
                      <p>{plan.labels.docs_all}</p>
                    ) : (
                      <ul className="space-y-2.5">
                        {p.documents.map((d) => (
                          <li key={d.document_name} className="flex gap-2">
                            <span aria-hidden="true" className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[0.6875rem] font-bold ${d.have ? "bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300" : "bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-400"}`}>
                              {d.have ? "✓" : "•"}
                            </span>
                            <div>
                              <p className={`font-medium ${d.have ? "text-gray-500 line-through decoration-brand-500/60 dark:text-gray-400" : "text-gray-900 dark:text-gray-100"}`}>
                                {d.document_name}
                                {!d.is_mandatory && <span className="ml-1.5 text-[0.75rem] font-normal text-gray-400">({t(lang, "optional")})</span>}
                              </p>
                              {d.how && <p className="text-[0.8125rem] text-gray-600 dark:text-gray-400">{d.how}</p>}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Step>
                  <Step n={2} title={plan.labels.go}>
                    {p.office && (
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-gray-100">{p.office.name}</p>
                        {p.office.address && <p>{p.office.address}</p>}
                        <p className="text-[0.8125rem] text-gray-500 dark:text-gray-400">{[p.office.hours, p.office.phone].filter(Boolean).join(" · ")}</p>
                      </div>
                    )}
                    {p.office_note && <p className="mt-1.5 text-[0.8125rem] text-amber-800 dark:text-amber-200">{p.office_note}</p>}
                  </Step>
                  <Step n={3} title={plan.labels.there}>
                    <p>{p.what_happens}</p>
                  </Step>
                  {p.schedules.length > 0 && (
                    <Step n={4} title={plan.labels.dates}>
                      <ul className="space-y-1">
                        {p.schedules.map((s, i) => (
                          <li key={i}>
                            <span className="font-medium">{s.start_date === s.end_date ? s.start_date : `${s.start_date} – ${s.end_date}`}</span> · {s.office_name}
                            {s.notes && <span className="text-gray-500 dark:text-gray-400"> · {s.notes}</span>}
                          </li>
                        ))}
                      </ul>
                    </Step>
                  )}
                </ol>
              </section>
            ))}

            <p className="text-xs leading-relaxed text-gray-500 dark:text-gray-400">{t(lang, "planNote")}</p>

            <div className="flex flex-col gap-3 print:hidden">
              {plan.programs.length > 0 && (
                <Button onClick={() => window.print()} className="w-full">
                  {t(lang, "planPrint")}
                </Button>
              )}
              <Link href={`/recommendations?session=${sessionId}`} className={buttonClasses("secondary", "w-full text-center")}>
                {t(lang, "planBackToPrograms")}
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function PlanPage() {
  return (
    <Suspense>
      <PlanInner />
    </Suspense>
  );
}
