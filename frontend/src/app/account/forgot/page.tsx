"use client";

import Link from "next/link";
import { FormEvent, Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Backdrop from "@/components/Backdrop";
import PageHeader from "@/components/PageHeader";
import Button from "@/components/Button";
import { citizenForgotComplete, citizenForgotStart, Lang } from "@/lib/api";
import { LANG_LABELS, t } from "@/lib/i18n";

// Citizen "forgot password" (accounts made with a username and password).
// Step 1: enter the username; a 6-digit code goes to the email given at sign-up.
// Step 2: enter the code and a new password. Google accounts recover through Google.

const field =
  "w-full rounded-2xl bg-white px-4 py-3 text-[0.9375rem] text-gray-900 ring-1 ring-gray-200 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-white/5 dark:text-gray-100 dark:ring-white/10";

function ForgotInner() {
  const params = useSearchParams();
  const p = params.get("lang");
  const lang: Lang = p === "fil" || p === "ceb" ? p : "en";
  const [step, setStep] = useState<"username" | "code" | "done">("username");
  const [username, setUsername] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await citizenForgotStart(username.trim());
      setStep("code"); // the reply is the same whether or not the username exists
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function savePassword(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError(t(lang, "acctPassMismatch"));
      return;
    }
    setBusy(true);
    try {
      await citizenForgotComplete(username.trim(), code.trim(), password);
      setStep("done");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative isolate min-h-screen overflow-hidden bg-white dark:bg-[#0a0f0c] sm:flex sm:items-center sm:justify-center sm:p-6 lg:p-10">
      <Backdrop />
      <main className="relative mx-auto flex min-h-screen w-full max-w-md flex-col p-5 text-gray-900 dark:text-gray-100 sm:min-h-0 sm:max-w-xl sm:rounded-4xl sm:bg-white/80 sm:p-8 sm:shadow-2xl sm:shadow-brand-900/15 sm:ring-1 sm:ring-black/5 sm:backdrop-blur-xl dark:sm:bg-white/4 dark:sm:ring-white/10">
        <PageHeader title={t(lang, "acctForgotTitle")} subtitle={LANG_LABELS[lang]} />

        <div className="relative z-10 mt-5 space-y-4">
          {step === "username" && (
            <form onSubmit={sendCode} className="space-y-3">
              <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-300">{t(lang, "acctForgotIntro")}</p>
              <label className="block">
                <span className="mb-1 block text-sm font-medium">{t(lang, "acctUsername")}</span>
                <input className={field} autoComplete="username" required minLength={4} maxLength={40} value={username} onChange={(e) => setUsername(e.target.value)} />
              </label>
              {error && <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</p>}
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? t(lang, "loading") : t(lang, "acctSendCode")}
              </Button>
            </form>
          )}

          {step === "code" && (
            <form onSubmit={savePassword} className="space-y-3">
              <p role="status" className="rounded-2xl bg-brand-50 px-4 py-3 text-sm leading-relaxed text-brand-900 ring-1 ring-brand-200 dark:bg-brand-500/10 dark:text-brand-200 dark:ring-brand-500/20">{t(lang, "acctCodeSent")}</p>
              <label className="block">
                <span className="mb-1 block text-sm font-medium">{t(lang, "acctCode")}</span>
                <input className={field} inputMode="numeric" autoComplete="one-time-code" required pattern="\s*\d{6}\s*" maxLength={8} value={code} onChange={(e) => setCode(e.target.value)} />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium">{t(lang, "acctNewPassword")}</span>
                <input className={field} type="password" autoComplete="new-password" required minLength={8} maxLength={200} value={password} onChange={(e) => setPassword(e.target.value)} />
                <span className="mt-1 block text-xs text-gray-500">{t(lang, "acctPassHint")}</span>
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium">{t(lang, "acctConfirmPassword")}</span>
                <input className={field} type="password" autoComplete="new-password" required minLength={8} maxLength={200} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
                {confirm && confirm !== password && <span className="mt-1 block text-xs text-red-600 dark:text-red-400">{t(lang, "acctPassMismatch")}</span>}
              </label>
              {error && <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</p>}
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? t(lang, "loading") : t(lang, "acctSetPassword")}
              </Button>
              <button type="button" onClick={() => { setStep("username"); setCode(""); setError(null); }} className="w-full px-1 py-1 text-xs font-semibold text-brand-700 hover:underline dark:text-brand-300">
                {t(lang, "acctSendCode")}
              </button>
            </form>
          )}

          {step === "done" && (
            <p role="status" className="rounded-2xl bg-brand-50 px-4 py-3 text-sm leading-relaxed text-brand-900 ring-1 ring-brand-200 dark:bg-brand-500/10 dark:text-brand-200 dark:ring-brand-500/20">{t(lang, "acctResetDone")}</p>
          )}

          <Link href={`/account?lang=${lang}`} className="inline-block px-1 py-1 text-sm font-semibold text-brand-700 hover:underline dark:text-brand-300">
            ← {t(lang, "acctBackToLogin")}
          </Link>
        </div>
      </main>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense>
      <ForgotInner />
    </Suspense>
  );
}
