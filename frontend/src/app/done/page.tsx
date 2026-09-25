"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Backdrop from "@/components/Backdrop";
import PageHeader from "@/components/PageHeader";
import Button, { buttonClasses } from "@/components/Button";
import { Lang, submitFeedback } from "@/lib/api";
import { SUS_ITEMS, t } from "@/lib/i18n";

// Fig. 22 session end + "Submit Service Experience Feedback" (Fig. 8).
// The session is already purged when this page opens; feedback is anonymous
// and never linked to the assessment (Table 18 has no foreign keys).

function DoneInner() {
  const param = useSearchParams().get("lang");
  const lang: Lang = param === "fil" || param === "ceb" ? param : "en";
  const [answers, setAnswers] = useState<(number | null)[]>(Array(10).fill(null));
  const [comment, setComment] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const complete = answers.every((a) => a !== null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!complete) return;
    setState("sending");
    try {
      await submitFeedback(answers as number[], comment);
      setState("sent");
    } catch (err) {
      setError((err as Error).message);
      setState("error");
    }
  }

  return (
    <div className="relative isolate min-h-screen overflow-hidden bg-white dark:bg-[#0a0f0c] sm:flex sm:items-center sm:justify-center sm:p-6 lg:p-10">
      <Backdrop />

      <main className="relative mx-auto flex min-h-screen w-full max-w-md flex-col p-5 text-gray-900 dark:text-gray-100 sm:min-h-0 sm:max-w-lg sm:rounded-[32px] sm:bg-white/70 sm:p-8 sm:shadow-2xl sm:shadow-brand-950/10 sm:ring-1 sm:ring-black/5 sm:backdrop-blur-xl dark:sm:bg-white/[0.04] dark:sm:ring-white/10">
        <PageHeader title="GinhawAI" />

        <section className="relative z-10 mt-8 flex flex-col items-center gap-3 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-green-600 dark:bg-green-500/15 dark:text-green-300">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true"><path d="M5 12l5 5L20 7" /></svg>
          </span>
          <h1 className="text-2xl font-bold tracking-tight">{t(lang, "doneTitle")}</h1>
          <p className="text-[14px] leading-relaxed text-gray-600 dark:text-gray-300">{t(lang, "donePurged")}</p>
        </section>

        <section className="relative z-10 mt-8 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5 dark:bg-white/[0.04] dark:ring-white/10">
          {state === "sent" ? (
            <p className="py-4 text-center text-[15px] font-semibold text-brand-800 dark:text-brand-300">{t(lang, "feedbackThanks")}</p>
          ) : (
            <form onSubmit={submit}>
              <h2 className="text-[15px] font-semibold">{t(lang, "feedbackTitle")}</h2>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t(lang, "feedbackHint")}</p>
              <ol className="mt-4 space-y-4">
                {SUS_ITEMS.map((item, i) => (
                  <li key={i}>
                    <p id={`sus-${i}`} className="mb-2 text-[13px] text-gray-800 dark:text-gray-200">
                      {i + 1}. {item[lang]}
                    </p>
                    <div role="radiogroup" aria-labelledby={`sus-${i}`} className="grid grid-cols-5 gap-1.5">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button
                          key={n}
                          type="button"
                          role="radio"
                          aria-checked={answers[i] === n}
                          onClick={() => setAnswers((a) => a.map((x, j) => (j === i ? n : x)))}
                          className={`rounded-xl py-2 text-sm font-semibold ring-1 transition ${answers[i] === n ? "bg-brand-700 text-white ring-brand-700" : "bg-white text-gray-600 ring-gray-200 hover:bg-gray-50 dark:bg-white/[0.04] dark:text-gray-300 dark:ring-white/10"}`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </li>
                ))}
              </ol>
              <label className="mt-5 block">
                <span className="mb-1.5 block text-[13px] text-gray-800 dark:text-gray-200">{t(lang, "comment")}</span>
                <textarea
                  rows={3}
                  maxLength={1000}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="w-full rounded-2xl bg-white px-3 py-2 text-sm ring-1 ring-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-white/[0.04] dark:ring-white/10"
                />
              </label>
              {error && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>}
              <Button type="submit" disabled={!complete || state === "sending"} className="mt-4 w-full">
                {t(lang, "submitFeedback")}
              </Button>
            </form>
          )}
        </section>

        <Link href="/" className={buttonClasses("secondary", "relative z-10 mt-6 w-full text-center")}>
          {t(lang, "newAssessment")}
        </Link>
      </main>
    </div>
  );
}

export default function DonePage() {
  return (
    <Suspense fallback={null}>
      <DoneInner />
    </Suspense>
  );
}
