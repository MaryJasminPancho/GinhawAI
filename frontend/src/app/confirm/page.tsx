"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Backdrop from "@/components/Backdrop";
import PageHeader from "@/components/PageHeader";
import Button, { buttonClasses } from "@/components/Button";
import { assess, editEntities, Entities, getSession, Lang, SessionExpiredError } from "@/lib/api";
import { BOOL_FIELDS, CHOICES, displayValue, FIELD_LABELS, FIELD_ORDER, NUMBER_FIELDS, t } from "@/lib/i18n";

// Fig. 17 — Data Confirmation: review every answer, fix any of them with
// "I-edit / Edit" without restarting, then "Kumpirmahin at Isumite".

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

const fieldInput =
  "w-full rounded-xl bg-white px-3 py-2 text-sm text-gray-900 ring-1 ring-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-white/[0.04] dark:text-gray-100 dark:ring-white/10";

function Editor({ field, value, lang, onSave, onCancel }: { field: string; value: unknown; lang: Lang; onSave: (v: unknown) => void; onCancel: () => void }) {
  const [draft, setDraft] = useState<string>(value === undefined || value === null ? "" : String(value));

  let control: React.ReactNode;
  if (BOOL_FIELDS.has(field)) {
    control = (
      <div className="flex gap-2">
        {[true, false].map((b) => (
          <button key={String(b)} type="button" onClick={() => onSave(b)} className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold ring-1 ${value === b ? "bg-brand-700 text-white ring-brand-700" : "bg-white text-gray-700 ring-gray-200 dark:bg-white/[0.04] dark:text-gray-200 dark:ring-white/10"}`}>
            {t(lang, b ? "yes" : "no")}
          </button>
        ))}
      </div>
    );
  } else if (CHOICES[field]) {
    control = (
      <select autoFocus className={fieldInput} value={draft} onChange={(e) => onSave(e.target.value)}>
        {CHOICES[field].map((c) => <option key={c.value} value={c.value}>{c.label[lang]}</option>)}
      </select>
    );
  } else {
    control = (
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          onSave(NUMBER_FIELDS.has(field) ? Number(draft.replace(/[^0-9.]/g, "")) : draft);
        }}
      >
        <input autoFocus inputMode={NUMBER_FIELDS.has(field) ? "numeric" : "text"} className={fieldInput} value={draft} onChange={(e) => setDraft(e.target.value)} />
        <button type="submit" className="rounded-xl bg-brand-700 px-3 py-2 text-sm font-semibold text-white">{t(lang, "save")}</button>
      </form>
    );
  }

  return (
    <div className="space-y-2 pt-2">
      {control}
      <button type="button" onClick={onCancel} className="text-xs font-semibold text-gray-500 hover:underline">{t(lang, "cancel")}</button>
    </div>
  );
}

function ConfirmInner() {
  const router = useRouter();
  const sessionId = useSearchParams().get("session");
  const [lang, setLang] = useState<Lang>("en");
  const [data, setData] = useState<Entities | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!sessionId) return;
    getSession(sessionId)
      .then((s) => {
        setLang(s.language);
        setData(s.entities);
      })
      .catch((e) => setError(e instanceof SessionExpiredError ? t("en", "sessionEnded") : e.message));
  }, [sessionId]);

  async function saveField(field: string, value: unknown) {
    if (!sessionId) return;
    setFieldError(null);
    try {
      const res = await editEntities(sessionId, { [field]: value });
      if (res.errors[field]) {
        setFieldError(field);
        return;
      }
      setData(res.entities);
      setEditing(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function submit() {
    if (!sessionId) return;
    setSubmitting(true);
    setError(null);
    try {
      await assess(sessionId);
      router.push(`/score?session=${sessionId}`);
    } catch (e) {
      setError((e as Error).message);
      setSubmitting(false);
    }
  }

  const missingSession = !sessionId;
  const complete = data ? FIELD_ORDER.every((f) => data[f] !== undefined && data[f] !== null) : false;

  return (
    <div className="relative isolate min-h-screen overflow-hidden bg-white dark:bg-[#0a0f0c] sm:flex sm:items-center sm:justify-center sm:p-6 lg:p-10">
      <Backdrop />

      <main className="relative mx-auto flex min-h-screen w-full max-w-md flex-col p-5 text-gray-900 dark:text-gray-100 sm:min-h-0 sm:max-w-lg sm:rounded-[32px] sm:bg-white/70 sm:p-8 sm:shadow-2xl sm:shadow-brand-950/10 sm:ring-1 sm:ring-black/5 sm:backdrop-blur-xl dark:sm:bg-white/[0.04] dark:sm:ring-white/10">
        <PageHeader title={t(lang, "confirmTitle")} step={3} totalSteps={4} />
        <p className="relative z-10 mt-4 text-[13px] text-gray-500 dark:text-gray-400">{t(lang, "confirmHint")}</p>

        <section className="relative z-10 mt-3 overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-black/5 dark:bg-white/[0.04] dark:ring-white/10">
          {missingSession && <ErrorNotice>{t(lang, "sessionEnded")}</ErrorNotice>}
          {error && <ErrorNotice>{error}</ErrorNotice>}
          {!missingSession && !error && data === null && <p className="p-4 text-sm text-gray-400 dark:text-gray-500">{t(lang, "loading")}</p>}
          {data && (
            <dl className="divide-y divide-gray-100 dark:divide-white/10">
              {FIELD_ORDER.map((key) => (
                <div key={key} className="px-5 py-3.5">
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-sm text-gray-500 dark:text-gray-400">{FIELD_LABELS[key][lang]}</dt>
                    <dd className="flex items-center gap-3 text-right text-sm font-semibold text-gray-900 dark:text-gray-100">
                      <span>{displayValue(key, data[key], lang)}</span>
                      {editing !== key && (
                        <button type="button" onClick={() => { setEditing(key); setFieldError(null); }} className="text-xs font-semibold text-brand-700 hover:underline dark:text-brand-300">
                          {t(lang, "edit")}
                        </button>
                      )}
                    </dd>
                  </div>
                  {editing === key && <Editor field={key} value={data[key]} lang={lang} onSave={(v) => saveField(key, v)} onCancel={() => setEditing(null)} />}
                  {fieldError === key && <p className="mt-1 text-xs text-red-600 dark:text-red-400">Please check this value.</p>}
                </div>
              ))}
            </dl>
          )}
        </section>

        <div className="relative z-10 mt-6 flex flex-col gap-3">
          <Button onClick={submit} disabled={!complete || submitting} className="w-full">
            {submitting ? t(lang, "checking") : t(lang, "confirmSubmit")}
          </Button>
          <Link href="/language" className={buttonClasses("secondary", "w-full text-center")}>
            {t(lang, "startOver")}
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