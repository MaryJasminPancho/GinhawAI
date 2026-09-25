"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Backdrop from "@/components/Backdrop";
import PageHeader from "@/components/PageHeader";
import Button, { buttonClasses } from "@/components/Button";
import { assess, Assessment, endSession, getSession, Lang, ProgramResult, sendDocumentChecks, sendSms, SessionExpiredError } from "@/lib/api";
import { t } from "@/lib/i18n";

// Figs. 19–22: ranked programs (green / amber / red), the explainable
// eligibility breakdown, document checklist + office directory, SMS delivery,
// and session end (which purges the citizen's data).

const STATUS = {
  qualified: { key: "qualified" as const, border: "border-l-green-500", badge: "bg-green-100 text-green-800 dark:bg-green-500/10 dark:text-green-300", dot: "bg-green-500" },
  partial: { key: "partial" as const, border: "border-l-amber-500", badge: "bg-amber-100 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300", dot: "bg-amber-500" },
  not_qualified: { key: "notQualified" as const, border: "border-l-red-400", badge: "bg-red-100 text-red-800 dark:bg-red-500/10 dark:text-red-300", dot: "bg-red-500" },
};

function fmtDay(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-PH", { month: "short", day: "numeric" });
}

function CriterionIcon({ status }: { status: "pass" | "fail" | "unknown" }) {
  if (status === "pass")
    return (
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300" aria-label="Passed">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" aria-hidden="true"><path d="M5 12l5 5L20 7" /></svg>
      </span>
    );
  if (status === "fail")
    return (
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300" aria-label="Not met">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
      </span>
    );
  return <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[11px] font-bold text-gray-500 dark:bg-white/10 dark:text-gray-400" aria-label="To be verified">?</span>;
}

function ProgramCard({ p, lang, have, onToggleDoc }: { p: ProgramResult; lang: Lang; have: Set<string>; onToggleDoc: (docId: string) => void }) {
  const st = STATUS[p.status];
  const matched = p.status !== "not_qualified";
  return (
    <details className={`group overflow-hidden rounded-2xl border-l-4 bg-white shadow-sm ring-1 ring-black/5 dark:bg-white/4 dark:ring-white/10 ${st.border}`}>
      <summary className="flex cursor-pointer list-none items-start justify-between gap-3 p-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold leading-snug text-gray-900 dark:text-white">{p.program_name}</h2>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{p.agency}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${st.badge}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
              {t(lang, st.key)}
            </span>
            <span className="text-xs font-semibold tabular-nums text-gray-500 dark:text-gray-400">
              {p.likelihood}% {t(lang, "likelihood")}
            </span>
          </div>
        </div>
        <svg className="mt-1 shrink-0 text-gray-300 transition group-open:rotate-180 dark:text-gray-600" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </summary>

      <div className="space-y-5 border-t border-gray-100 px-4 py-4 dark:border-white/10">
        {/* Fig. 20 — Explainable eligibility breakdown */}
        <div>
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500">{t(lang, "whyTitle")}</h3>
          <ul className="space-y-2.5">
            {p.criteria.map((c, i) => (
              <li key={i} className="flex gap-2.5 text-[13px]">
                <CriterionIcon status={c.status} />
                <div>
                  <p className="font-medium text-gray-800 dark:text-gray-200">{c.label}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{c.status === "unknown" ? t(lang, "toVerify") : c.explanation}</p>
                </div>
              </li>
            ))}
            {p.criteria.length === 0 && <li className="text-xs text-gray-500">{t(lang, "toVerify")}</li>}
          </ul>
        </div>

        {/* Fig. 21 — Document checklist */}
        {matched && p.documents.length > 0 && (
          <div>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500">{t(lang, "documentsTitle")}</h3>
            <ul className="space-y-2">
              {p.documents.map((d) => (
                <li key={d.doc_id}>
                  <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-gray-50 p-3 dark:bg-white/4">
                    <input type="checkbox" checked={have.has(d.doc_id)} onChange={() => onToggleDoc(d.doc_id)} className="mt-0.5 h-4 w-4 shrink-0 accent-brand-600" />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-1.5 text-[13px] font-medium text-gray-800 dark:text-gray-200">
                        {d.document_name}
                        <span className={`rounded-full px-1.5 text-[10px] font-semibold ${d.is_mandatory ? "bg-brand-100 text-brand-800 dark:bg-brand-500/15 dark:text-brand-300" : "bg-gray-200 text-gray-600 dark:bg-white/10 dark:text-gray-400"}`}>
                          {t(lang, d.is_mandatory ? "required" : "optional")}
                        </span>
                      </span>
                      {d.notes && <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">{d.notes}</span>}
                      <span className="mt-1 block text-[11px] text-gray-400">{t(lang, "iHaveThis")}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        )}

        {matched && p.schedules.length > 0 && (
          <div>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500">{t(lang, "schedulesTitle")}</h3>
            <ul className="space-y-2">
              {p.schedules.map((s) => (
                <li key={s.schedule_id} className="rounded-xl bg-brand-50/70 p-3 text-[13px] dark:bg-brand-500/10">
                  <p className="font-semibold text-brand-900 dark:text-brand-200">
                    {fmtDay(s.start_date)} – {fmtDay(s.end_date)} · {s.office_name}
                  </p>
                  {s.notes && <p className="mt-0.5 text-xs text-brand-800/80 dark:text-brand-300/80">{s.notes}</p>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </details>
  );
}

function RecommendationsInner() {
  const router = useRouter();
  const sessionId = useSearchParams().get("session");
  const [lang, setLang] = useState<Lang>("en");
  const [result, setResult] = useState<Assessment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [have, setHave] = useState<Set<string>>(new Set());
  const [touched, setTouched] = useState<Set<string>>(new Set()); // programs whose checklist the citizen used
  const [phone, setPhone] = useState("");
  const [sms, setSms] = useState<{ state: "idle" | "sending" | "sent" | "error"; text?: string }>({ state: "idle" });
  const [finishing, setFinishing] = useState(false);

  useEffect(() => {
    if (!sessionId) return;
    getSession(sessionId)
      .then(async (s) => {
        setLang(s.language);
        setResult(s.assessment ?? (await assess(sessionId)));
      })
      .catch((e) => setError(e instanceof SessionExpiredError ? t("en", "sessionEnded") : e.message));
  }, [sessionId]);

  const matched = result?.programs.filter((p) => p.status !== "not_qualified") ?? [];
  const others = result?.programs.filter((p) => p.status === "not_qualified") ?? [];

  function toggleDoc(programId: string, docId: string) {
    setHave((h) => {
      const n = new Set(h);
      if (n.has(docId)) n.delete(docId);
      else n.add(docId);
      return n;
    });
    setTouched((s) => new Set(s).add(programId));
  }

  async function onSendSms(e: React.FormEvent) {
    e.preventDefault();
    if (!sessionId) return;
    setSms({ state: "sending" });
    try {
      const r = await sendSms(sessionId, phone);
      setSms({ state: "sent", text: r.masked_recipient });
    } catch (err) {
      setSms({ state: "error", text: (err as Error).message });
    }
  }

  async function finish() {
    if (!sessionId || !result) return;
    setFinishing(true);
    // Anonymous "which documents do you already have" answers, only for
    // checklists the citizen actually used (feeds the Document Deficiency Report).
    const checks = matched
      .filter((p) => touched.has(p.program_id))
      .flatMap((p) => p.documents.map((d) => ({ doc_id: d.doc_id, has_document: have.has(d.doc_id) })));
    try {
      if (checks.length) await sendDocumentChecks(sessionId, checks);
    } catch {}
    try {
      await endSession(sessionId);
    } catch {}
    router.push(`/done?lang=${lang}`);
  }

  return (
    <div className="relative isolate min-h-screen overflow-hidden bg-white dark:bg-[#0a0f0c] sm:flex sm:items-center sm:justify-center sm:p-6 lg:p-10">
      <Backdrop />

      <main className="relative mx-auto flex min-h-screen w-full max-w-md flex-col p-5 text-gray-900 dark:text-gray-100 sm:min-h-0 sm:max-w-lg sm:rounded-4xl sm:bg-white/70 sm:p-8 sm:shadow-2xl sm:shadow-brand-950/10 sm:ring-1 sm:ring-black/5 sm:backdrop-blur-xl dark:sm:bg-white/4 dark:sm:ring-white/10">
        <PageHeader title={t(lang, "programsTitle")} subtitle={result?.barangay ? `Brgy. ${result.barangay}` : undefined} />

        <div className="relative z-10 mt-6 space-y-3">
          {!sessionId && <p className="text-sm text-red-600 dark:text-red-400">{t(lang, "sessionEnded")}</p>}
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          {sessionId && !error && !result && <p className="text-sm text-gray-400 dark:text-gray-500">{t(lang, "loading")}</p>}
          {result && matched.length === 0 && (
            <p className="rounded-2xl bg-amber-50 p-4 text-[13px] leading-relaxed text-amber-900 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-500/20">{t(lang, "noPrograms")}</p>
          )}
          {matched.map((p) => (
            <ProgramCard key={p.program_id} p={p} lang={lang} have={have} onToggleDoc={(d) => toggleDoc(p.program_id, d)} />
          ))}
          {others.length > 0 && (
            <details className="group rounded-2xl">
              <summary className="cursor-pointer list-none px-1 py-2 text-xs font-semibold text-gray-500 hover:text-gray-700 dark:text-gray-400">
                {t(lang, "otherPrograms")} ({others.length}) ▾
              </summary>
              <div className="mt-2 space-y-3">
                {others.map((p) => (
                  <ProgramCard key={p.program_id} p={p} lang={lang} have={have} onToggleDoc={(d) => toggleDoc(p.program_id, d)} />
                ))}
              </div>
            </details>
          )}
        </div>

        {/* Fig. 21 — Office directory */}
        {result && result.offices.length > 0 && (
          <section className="relative z-10 mt-6">
            <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500">{t(lang, "officesTitle")}</h2>
            <ul className="space-y-2">
              {result.offices.map((o) => (
                <li key={o.office_id} className="rounded-2xl bg-white p-4 text-[13px] shadow-sm ring-1 ring-black/5 dark:bg-white/4 dark:ring-white/10">
                  <p className="font-semibold text-gray-900 dark:text-white">{o.office_name}</p>
                  {o.address && <p className="mt-0.5 text-gray-600 dark:text-gray-300">{o.address}</p>}
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {[o.operating_hours, o.contact_number].filter(Boolean).join(" · ")}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Figs. 21–22 — SMS delivery */}
        {result && matched.length > 0 && (
          <section className="relative z-10 mt-6 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5 print:hidden dark:bg-white/4 dark:ring-white/10">
            {sms.state === "sent" ? (
              <div className="flex flex-col items-center gap-2 py-2 text-center">
                <span className="flex h-12 w-12 animate-[pulse_1s_ease-out_1] items-center justify-center rounded-full bg-green-100 text-green-600 dark:bg-green-500/15 dark:text-green-300">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true"><path d="M5 12l5 5L20 7" /></svg>
                </span>
                <p className="text-[15px] font-bold text-gray-900 dark:text-white">{t(lang, "sent")}</p>
                <p className="font-mono text-xs text-gray-500">{sms.text}</p>
              </div>
            ) : (
              <form onSubmit={onSendSms}>
                <h2 className="text-[15px] font-semibold text-gray-900 dark:text-white">{t(lang, "smsTitle")}</h2>
                <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-gray-400">{t(lang, "smsHint")}</p>
                <div className="mt-3 flex gap-2">
                  <input
                    aria-label="Mobile number"
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="09XX XXX XXXX"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="flex-1 rounded-full bg-white px-4 py-2.5 text-[14px] text-gray-900 ring-1 ring-gray-200 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-white/4 dark:text-gray-100 dark:ring-white/10"
                  />
                  <button type="submit" disabled={!phone || sms.state === "sending"} className="rounded-full bg-linear-to-b from-brand-600 to-brand-700 px-5 text-sm font-semibold text-white shadow-sm disabled:opacity-50">
                    {sms.state === "sending" ? t(lang, "sending") : t(lang, "send")}
                  </button>
                </div>
                {sms.state === "error" && <p className="mt-2 text-xs font-medium text-red-600 dark:text-red-400">{sms.text}</p>}
              </form>
            )}
          </section>
        )}

        <p className="relative z-10 mt-4 text-xs leading-relaxed text-gray-400 dark:text-gray-500">{t(lang, "disclaimer")}</p>

        <div className="relative z-10 mt-6 flex flex-col gap-3 print:hidden">
          {result && matched.length > 0 && (
            <Button variant="secondary" onClick={() => window.print()} className="w-full">
              {t(lang, "saveChecklist")}
            </Button>
          )}
          {result ? (
            <Button onClick={finish} disabled={finishing} className="w-full">
              {t(lang, "finish")}
            </Button>
          ) : (
            <Link href="/language" className={buttonClasses("secondary", "w-full text-center")}>
              {t(lang, "startOver")}
            </Link>
          )}
        </div>
      </main>
    </div>
  );
}

export default function RecommendationsPage() {
  return (
    <Suspense fallback={null}>
      <RecommendationsInner />
    </Suspense>
  );
}