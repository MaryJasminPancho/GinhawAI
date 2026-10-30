"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Backdrop from "@/components/Backdrop";
import PageHeader from "@/components/PageHeader";
import Button, { buttonClasses } from "@/components/Button";
import { CitizenAccount, citizenLogout, deleteMyAccount, getCitizenToken, getMyAccount, Lang } from "@/lib/api";
import { displayValue, FIELD_LABELS, FIELD_ORDER, LANG_LABELS, t } from "@/lib/i18n";

// "My account" for citizens who chose to sign up: saved answers, past results,
// check again with saved answers, log out, delete everything.

const TIER = {
  high: { en: "High need", fil: "Mataas na pangangailangan", ceb: "Taas nga panginahanglan", cls: "bg-red-50 text-red-700 ring-red-200 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-500/20" },
  moderate: { en: "Moderate need", fil: "Katamtamang pangangailangan", ceb: "Kasarangang panginahanglan", cls: "bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-500/20" },
  low: { en: "Low need", fil: "Mababang pangangailangan", ceb: "Ubos nga panginahanglan", cls: "bg-brand-50 text-brand-800 ring-brand-200 dark:bg-brand-500/10 dark:text-brand-200 dark:ring-brand-500/20" },
};

function MeInner() {
  const router = useRouter();
  const p = useSearchParams().get("lang");
  const [lang] = useState<Lang>(p === "fil" || p === "ceb" ? p : "en");
  const [acct, setAcct] = useState<CitizenAccount | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getCitizenToken()) {
      router.replace(`/account?lang=${lang}`);
      return;
    }
    getMyAccount()
      .then(setAcct)
      .catch((e) => {
        // Expired or deleted account: sign out on this device and go to the login page.
        citizenLogout();
        setError(e.message);
        router.replace(`/account?lang=${lang}`);
      });
  }, [router, lang]);

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

  return (
    <div className="relative isolate min-h-screen overflow-hidden bg-white dark:bg-[#0a0f0c] sm:flex sm:items-center sm:justify-center sm:p-6 lg:p-10">
      <Backdrop />
      <main className="relative mx-auto flex min-h-screen w-full max-w-md flex-col p-5 text-gray-900 dark:text-gray-100 sm:min-h-0 sm:max-w-2xl sm:rounded-4xl sm:bg-white/80 sm:p-8 sm:shadow-2xl sm:shadow-brand-900/15 sm:ring-1 sm:ring-black/5 sm:backdrop-blur-xl dark:sm:bg-white/4 dark:sm:ring-white/10">
        <PageHeader title={t(lang, "acctMyAccount")} subtitle={LANG_LABELS[lang]} />

        {error && <p className="relative z-10 mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</p>}
        {!acct && !error && <p className="relative z-10 mt-6 text-sm text-gray-400">{t(lang, "loading")}</p>}

        {acct && (
          <div className="relative z-10 mt-5 space-y-5">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                {t(lang, "acctHi")}, {acct.display_name}!
              </h1>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {t(lang, "acctSignedInWith")} {acct.signed_in_with === "google" ? `Google (${acct.email})` : acct.username}
              </p>
            </div>

            <Link href={`/chat?lang=${acct.profile?.language || lang}`} className={buttonClasses("primary", "w-full")}>
              {t(lang, hasSaved ? "acctCheckAgain" : "acctNewCheck")}
            </Link>

            <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5 dark:bg-white/4 dark:ring-white/10">
              <h2 className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">{t(lang, "acctSavedAnswers")}</h2>
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

            <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5 dark:bg-white/4 dark:ring-white/10">
              <h2 className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">{t(lang, "acctHistory")}</h2>
              {acct.history.length === 0 ? (
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{t(lang, "acctNoHistory")}</p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {acct.history.map((h) => {
                    const tier = h.tier ? TIER[h.tier] : null;
                    const fits = h.programs.filter((x) => x.status === "qualified" || x.status === "partial");
                    return (
                      <li key={h.assessment_id} className="rounded-2xl bg-gray-50 p-3.5 dark:bg-white/[0.03]">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-sm font-semibold">{new Date(h.created_at).toLocaleDateString(lang === "en" ? "en-PH" : "fil-PH", { dateStyle: "medium" })}</span>
                          {tier && <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${tier.cls}`}>{tier[lang]}</span>}
                        </div>
                        {fits.length > 0 && (
                          <p className="mt-1.5 text-sm text-gray-600 dark:text-gray-300">
                            {fits.length} {t(lang, "acctQualified")}: {fits.map((x) => x.program_name).join(", ")}
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="secondary" className="flex-1" onClick={logout}>
                {t(lang, "acctLogout")}
              </Button>
              <button type="button" onClick={remove} className="flex-1 rounded-2xl px-6 py-3.5 text-[0.9375rem] font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10">
                {t(lang, "acctDelete")}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function MePage() {
  return (
    <Suspense>
      <MeInner />
    </Suspense>
  );
}
