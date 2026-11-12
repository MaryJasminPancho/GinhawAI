"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { RecheckCard, RemindersCard, TrackerCard, useTracker } from "@/components/AccountExtras";
import Backdrop from "@/components/Backdrop";
import { buttonClasses } from "@/components/Button";
import {
  ChecklistProgram, CitizenAccount, citizenLogout, deleteMyAccount, getCitizenToken, getMyAccount, getMyChecklist, Lang, setMyDocument, subscribeCitizen,
} from "@/lib/api";
import { displayValue, FIELD_LABELS, FIELD_ORDER, t } from "@/lib/i18n";

// The signed-in home screen. It looks different from the start page on purpose (green banner,
// avatar, "Signed in" badge) so a citizen can see at a glance that they are logged in, and it
// shows their own data straight away: what changed, "did something change?", their applications,
// the document checklist, reminders, saved answers and past results. The login lasts 30 minutes; when it ends this page sends them back to log in.

const TIER = {
  high: { en: "High need", fil: "Mataas na pangangailangan", ceb: "Taas nga panginahanglan", cls: "bg-red-50 text-red-700 ring-red-200 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-500/20" },
  moderate: { en: "Moderate need", fil: "Katamtamang pangangailangan", ceb: "Kasarangang panginahanglan", cls: "bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-500/20" },
  low: { en: "Low need", fil: "Mababang pangangailangan", ceb: "Ubos nga panginahanglan", cls: "bg-brand-50 text-brand-800 ring-brand-200 dark:bg-brand-500/10 dark:text-brand-200 dark:ring-brand-500/20" },
};
const RANK = { low: 0, moderate: 1, high: 2 };

const card = "rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5 dark:bg-white/4 dark:ring-white/10";
const cardTitle = "text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400";

type Check = CitizenAccount["history"][number];
const fits = (c: Check) => new Set(c.programs.filter((x) => x.status === "qualified" || x.status === "partial").map((x) => x.program_name));

/** "What changed since your last check": the newest check compared with the one before it. */
function Changes({ history, lang }: { history: Check[]; lang: Lang }) {
  const sorted = [...history].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
  if (sorted.length < 2) return <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{t(lang, "dashChangesNone")}</p>;

  const [now, before] = sorted;
  const nowFits = fits(now);
  const beforeFits = fits(before);
  const gained = [...nowFits].filter((n) => !beforeFits.has(n));
  const lost = [...beforeFits].filter((n) => !nowFits.has(n));
  const date = new Date(before.created_at).toLocaleDateString(lang === "en" ? "en-PH" : "fil-PH", { dateStyle: "medium" });
  const tierNow = now.tier ? TIER[now.tier] : null;
  const tierBefore = before.tier ? TIER[before.tier] : null;
  const up = now.tier && before.tier ? RANK[now.tier] - RANK[before.tier] : 0;

  return (
    <div className="mt-3 space-y-3 text-sm">
      <p className="text-xs text-gray-500 dark:text-gray-400">
        {t(lang, "dashSince")} {date}
      </p>
      {tierNow && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-gray-600 dark:text-gray-300">{t(lang, "dashNeedLevel")}:</span>
          {tierBefore && tierBefore !== tierNow && (
            <>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${tierBefore.cls}`}>{tierBefore[lang]}</span>
              <span aria-hidden="true">{up > 0 ? "↑" : "↓"}</span>
            </>
          )}
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${tierNow.cls}`}>{tierNow[lang]}</span>
          {now.score != null && before.score != null && now.score !== before.score && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              ({before.score} → {now.score})
            </span>
          )}
        </div>
      )}
      {gained.length > 0 && (
        <div>
          <p className="font-semibold text-brand-800 dark:text-brand-300">+ {t(lang, "dashNewPrograms")}</p>
          <p className="mt-0.5 text-gray-700 dark:text-gray-200">{gained.join(", ")}</p>
        </div>
      )}
      {lost.length > 0 && (
        <div>
          <p className="font-semibold text-amber-800 dark:text-amber-300">− {t(lang, "dashLostPrograms")}</p>
          <p className="mt-0.5 text-gray-700 dark:text-gray-200">{lost.join(", ")}</p>
        </div>
      )}
      {gained.length === 0 && lost.length === 0 && <p className="text-gray-600 dark:text-gray-300">{t(lang, "dashSame")}</p>}
    </div>
  );
}

function MeInner() {
  const router = useRouter();
  // False once the 30-minute login ends (checked every few seconds); then back to the login page.
  const signedIn = useSyncExternalStore(subscribeCitizen, () => !!getCitizenToken(), () => true);
  const [acct, setAcct] = useState<CitizenAccount | null>(null);
  const [checklist, setChecklist] = useState<ChecklistProgram[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tickError, setTickError] = useState(false);
  const [tracker, setTracker] = useTracker();

  // The language is the one used in the last check (the start of every new check asks again).
  const lang: Lang = acct?.profile?.language ?? "en";

  useEffect(() => {
    if (!signedIn) router.replace("/account");
  }, [signedIn, router]);

  useEffect(() => {
    if (!getCitizenToken()) return;
    getMyAccount()
      .then(setAcct)
      .catch((e) => {
        // Expired or deleted account: sign out on this device and go to the login page.
        citizenLogout();
        setError(e.message);
        router.replace("/account");
      });
    getMyChecklist()
      .then((r) => setChecklist(r.programs))
      .catch(() => setChecklist([]));
  }, [router]);

  /** Tick or untick one document: the box changes at once, then it is saved; undone if saving fails. */
  function toggle(docId: string, have: boolean) {
    const apply = (value: boolean) =>
      setChecklist((cl) =>
        (cl ?? []).map((p) => {
          const documents = p.documents.map((d) => (d.doc_id === docId ? { ...d, have: value } : d));
          return { ...p, documents, ready: documents.filter((d) => d.have).length };
        }),
      );
    setTickError(false);
    apply(have);
    setMyDocument(docId, have).catch(() => {
      apply(!have);
      setTickError(true);
    });
  }

  function logout() {
    citizenLogout();
    router.replace("/");
  }

  async function remove() {
    if (!window.confirm(t(lang, "acctDeleteConfirm"))) return;
    try {
      await deleteMyAccount();
      router.replace("/");
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const saved = acct?.profile?.entities;
  const hasSaved = !!saved && Object.keys(saved).length > 0;
  const totals = useMemo(() => {
    const list = checklist ?? [];
    return { ready: list.reduce((n, p) => n + p.ready, 0), total: list.reduce((n, p) => n + p.total, 0) };
  }, [checklist]);
  const name = acct?.display_name || acct?.username || "";

  return (
    <div className="relative isolate min-h-screen overflow-hidden bg-white dark:bg-[#0a0f0c] sm:flex sm:items-center sm:justify-center sm:p-6 lg:p-10">
      <Backdrop />
      <main className="relative mx-auto flex min-h-screen w-full max-w-md flex-col text-gray-900 dark:text-gray-100 sm:min-h-0 sm:max-w-3xl sm:overflow-hidden sm:rounded-4xl sm:bg-white/80 sm:shadow-2xl sm:shadow-brand-900/15 sm:ring-1 sm:ring-black/5 sm:backdrop-blur-xl dark:sm:bg-white/4 dark:sm:ring-white/10">
        {/* Banner: the green band, the avatar and the "Signed in" badge show at a glance that the citizen is logged in. */}
        <header className="bg-gradient-to-br from-brand-700 to-brand-600 px-5 pb-6 pt-5 text-white sm:px-8">
          <div className="flex items-start justify-between gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold ring-1 ring-white/25">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
              {t(lang, "dashSignedIn")}
            </span>
            <button
              type="button"
              onClick={logout}
              className="inline-flex min-h-11 items-center rounded-full border-2 border-white/70 px-5 text-sm font-semibold text-white transition hover:bg-white/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              {t(lang, "acctLogout")}
            </button>
          </div>
          {acct && (
            <div className="mt-4 flex items-center gap-4">
              <span aria-hidden="true" className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white text-2xl font-bold text-brand-700 shadow-md">
                {name.charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0">
                <h1 className="truncate text-2xl font-bold tracking-tight">
                  {t(lang, "dashWelcome")}, {name}!
                </h1>
                <p className="mt-0.5 truncate text-sm text-white/80">
                  {t(lang, "acctSignedInWith")} {acct.signed_in_with === "google" ? `Google (${acct.email})` : acct.username}
                </p>
              </div>
            </div>
          )}
        </header>

        <div className="space-y-5 p-5 sm:p-8">
          {error && <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</p>}
          {!acct && !error && <p className="text-sm text-gray-400">{t(lang, "loading")}</p>}

          {acct && (
            <>
              {/* Every new check goes through the language page. */}
              <Link href="/language" className={buttonClasses("primary", "w-full")}>
                {t(lang, "dashStart")}
              </Link>

              <section className={card}>
                <h2 className={cardTitle}>{t(lang, "dashChangesTitle")}</h2>
                <Changes history={acct.history} lang={lang} />
              </section>

              <RecheckCard tracker={tracker} lang={lang} />

              <TrackerCard tracker={tracker} setTracker={setTracker} lang={lang} />

              <section className={card}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className={cardTitle}>{t(lang, "dashChecklistTitle")}</h2>
                  {totals.total > 0 && (
                    <span className="text-sm font-semibold text-brand-800 dark:text-brand-300">
                      {totals.ready} {t(lang, "dashOf")} {totals.total} {t(lang, "dashReady")}
                    </span>
                  )}
                </div>
                {checklist === null ? (
                  <p className="mt-2 text-sm text-gray-400">{t(lang, "loading")}</p>
                ) : checklist.length === 0 ? (
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{t(lang, "dashChecklistNone")}</p>
                ) : (
                  <>
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{t(lang, "dashChecklistHint")}</p>
                    {tickError && (
                      <p role="alert" className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
                        {t(lang, "dashSaveFailed")}
                      </p>
                    )}
                    <div className="mt-3 space-y-4">
                      {checklist.map((p) => (
                        <div key={p.program_name}>
                          <div className="flex items-center justify-between gap-2">
                            <h3 className="text-sm font-semibold">{p.program_name}</h3>
                            <span className={`text-xs font-semibold ${p.ready === p.total ? "text-brand-700 dark:text-brand-300" : "text-gray-500 dark:text-gray-400"}`}>
                              {p.ready} {t(lang, "dashOf")} {p.total} {t(lang, "dashReady")}
                            </span>
                          </div>
                          {/* Progress bar: the same number as the text, so it is not colour-only. */}
                          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10" aria-hidden="true">
                            <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${p.total ? (p.ready / p.total) * 100 : 0}%` }} />
                          </div>
                          <ul className="mt-1">
                            {p.documents.map((d) => (
                              <li key={d.doc_id}>
                                <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-1 text-sm hover:bg-gray-50 dark:hover:bg-white/5">
                                  <input type="checkbox" className="h-5 w-5 shrink-0 accent-brand-600" checked={d.have} onChange={(e) => toggle(d.doc_id, e.target.checked)} />
                                  <span className={d.have ? "text-gray-500 line-through dark:text-gray-400" : ""}>
                                    {d.document_name}
                                    {d.is_mandatory && <span className="ml-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300">({t(lang, "dashRequired")})</span>}
                                  </span>
                                </label>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </section>

              <RemindersCard lang={lang} />

              <section className={card}>
                <h2 className={cardTitle}>{t(lang, "acctSavedAnswers")}</h2>
                {hasSaved ? (
                  <>
                    <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
                      {FIELD_ORDER.map((f) => (
                        <div key={f} className="flex justify-between gap-3 border-b border-gray-100 pb-1.5 text-sm dark:border-white/5">
                          <dt className="text-gray-500 dark:text-gray-400">{FIELD_LABELS[f][lang]}</dt>
                          <dd className="text-right font-medium">{displayValue(f, saved![f], lang)}</dd>
                        </div>
                      ))}
                    </dl>
                    <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">{t(lang, "acctEditHint")}</p>
                  </>
                ) : (
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{t(lang, "acctNoSaved")}</p>
                )}
              </section>

              <section className={card}>
                <h2 className={cardTitle}>{t(lang, "acctHistory")}</h2>
                {acct.history.length === 0 ? (
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{t(lang, "acctNoHistory")}</p>
                ) : (
                  <ul className="mt-3 space-y-3">
                    {acct.history.map((h) => {
                      const tier = h.tier ? TIER[h.tier] : null;
                      const matched = h.programs.filter((x) => x.status === "qualified" || x.status === "partial");
                      return (
                        <li key={h.assessment_id} className="rounded-2xl bg-gray-50 p-3.5 dark:bg-white/[0.03]">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-sm font-semibold">{new Date(h.created_at).toLocaleDateString(lang === "en" ? "en-PH" : "fil-PH", { dateStyle: "medium" })}</span>
                            {tier && <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${tier.cls}`}>{tier[lang]}</span>}
                          </div>
                          {matched.length > 0 && (
                            <p className="mt-1.5 text-sm text-gray-600 dark:text-gray-300">
                              {matched.length} {t(lang, "acctQualified")}: {matched.map((x) => x.program_name).join(", ")}
                            </p>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              <div className="flex flex-col items-center gap-3 pt-1">
                <Link href="/programs" className="text-sm font-semibold text-brand-700 hover:underline dark:text-brand-300">
                  {t(lang, "browseTitle")}
                </Link>
                <button type="button" onClick={remove} className="min-h-11 rounded-2xl px-6 text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10">
                  {t(lang, "acctDelete")}
                </button>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

export default function MePage() {
  return <MeInner />;
}
