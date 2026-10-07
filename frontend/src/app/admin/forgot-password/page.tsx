"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import Backdrop from "@/components/Backdrop";
import Button from "@/components/Button";
import ThemeToggle from "@/components/ThemeToggle";
import PasswordChecklist, { passwordOk } from "@/components/admin/PasswordChecklist";
import { inputClass } from "@/components/admin/ui";
import { forgotPasswordComplete, forgotPasswordStart } from "@/lib/adminApi";

// "Forgot / Reset Password" (Appendix R module 6). A 6-digit code is sent to the
// staff member's verified email address; the new password
// they choose then waits for a System Administrator's approval like every other
// password change.

type Step = "username" | "code" | "done";

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<Step>("username");
  const [username, setUsername] = useState("");
  const [code, setCode] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [applied, setApplied] = useState(false);
  const [cooldown, setCooldown] = useState(0); // seconds before "Send a new code" works again

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function sendCode(e?: FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setNotice((await forgotPasswordStart(username)).message);
      setStep("code");
      setCooldown(60);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the code");
    } finally {
      setBusy(false);
    }
  }

  async function finish(e: FormEvent) {
    e.preventDefault();
    if (!passwordOk(next, confirm)) {
      setError("Your new password doesn't meet all the rules yet.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      setApplied((await forgotPasswordComplete(username, code, next)).applied);
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset the password");
    } finally {
      setBusy(false);
    }
  }

  const type = show ? "text" : "password";
  const alert = "rounded-xl px-3 py-2 text-[13px]";

  return (
    <div className="relative isolate min-h-screen overflow-hidden bg-white dark:bg-[#0a0f0c] sm:flex sm:items-center sm:justify-center sm:p-6 lg:p-10">
      <Backdrop />
      <main className="relative mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-7 p-6 text-gray-900 dark:text-gray-100 sm:min-h-0 sm:rounded-[32px] sm:bg-white/70 sm:p-10 sm:shadow-2xl sm:shadow-brand-950/10 sm:ring-1 sm:ring-black/5 sm:backdrop-blur-xl dark:sm:bg-white/[0.04] dark:sm:ring-white/10">
        <div className="absolute right-4 top-4">
          <ThemeToggle />
        </div>

        <div className="flex flex-col items-center gap-4 text-center">
          <div className="rounded-[24px] bg-white p-3 shadow-sm ring-1 ring-black/5">
            <Image src="/logo.png" alt="GinhawAI" width={243} height={313} priority className="h-16 w-auto" />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-2xl font-bold tracking-tight">{step === "done" ? "Request sent" : "Forgot your password?"}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {step === "username" && "We'll email a 6-digit code to the address you verified on My Account."}
              {step === "code" && "Enter the code we sent you, then choose a new password. Check your spam folder if you don't see the email."}
              {step === "done" && (applied ? "Your password was changed. You can sign in with it now." : "A System Administrator needs to approve your new password. You can sign in with it once it's approved.")}
            </p>
          </div>
        </div>

        {step === "username" && (
          <form onSubmit={sendCode} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="fp-username" className="block text-xs font-semibold text-gray-600 dark:text-gray-300">Username</label>
              <input id="fp-username" autoComplete="username" required value={username} onChange={(e) => setUsername(e.target.value)} className={`${inputClass} py-3`} />
            </div>
            {error && <p className={`${alert} bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300`}>{error}</p>}
            <Button type="submit" disabled={busy || !username.trim()} className="w-full">{busy ? "Sending…" : "Send me a code"}</Button>
            <p className="text-center text-xs text-gray-400 dark:text-gray-500">No verified email on your account? Ask your System Administrator to reset your password.</p>
          </form>
        )}

        {step === "code" && (
          <form onSubmit={finish} className="space-y-4">
            {notice && <p className={`${alert} bg-brand-50 text-brand-900 ring-1 ring-brand-100 dark:bg-brand-500/10 dark:text-brand-200 dark:ring-brand-500/20`}>{notice}</p>}
            <div className="space-y-1.5">
              <label htmlFor="fp-code" className="block text-xs font-semibold text-gray-600 dark:text-gray-300">6-digit code</label>
              <input
                id="fp-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                required
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className={`${inputClass} py-3 text-center font-mono text-xl tracking-[0.4em]`}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="fp-new" className="block text-xs font-semibold text-gray-600 dark:text-gray-300">New password</label>
              <input id="fp-new" type={type} required autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} className={`${inputClass} py-3`} />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="fp-confirm" className="block text-xs font-semibold text-gray-600 dark:text-gray-300">Type the new password again</label>
              <input id="fp-confirm" type={type} required autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={`${inputClass} py-3`} />
            </div>
            <PasswordChecklist password={next} confirm={confirm} />
            <label className="flex items-center gap-2 text-[13px] text-gray-600 dark:text-gray-300">
              <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} className="h-4 w-4 accent-brand-600" />
              Show passwords
            </label>
            {error && <p className={`${alert} bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300`}>{error}</p>}
            <Button type="submit" disabled={busy || code.length !== 6 || !passwordOk(next, confirm)} className="w-full">{busy ? "Checking…" : "Reset password"}</Button>
            <button
              type="button"
              onClick={() => sendCode()}
              disabled={busy || cooldown > 0}
              className="w-full text-center text-xs font-semibold text-brand-700 hover:underline disabled:cursor-not-allowed disabled:text-gray-400 disabled:no-underline dark:text-brand-300"
            >
              {cooldown > 0 ? `Didn't get it? Send a new code in ${cooldown}s` : "Didn't get it? Send a new code"}
            </button>
          </form>
        )}

        {step === "done" && (
          <Link href="/admin/login" className="inline-flex w-full items-center justify-center rounded-2xl bg-gradient-to-b from-brand-600 to-brand-700 px-6 py-3.5 text-[15px] font-semibold text-white shadow-sm">
            Back to sign in
          </Link>
        )}

        {step !== "done" && (
          <Link href="/admin/login" className="text-center text-xs font-medium text-gray-400 hover:text-brand-700 dark:text-gray-500 dark:hover:text-brand-300">
            ← Back to sign in
          </Link>
        )}
      </main>
    </div>
  );
}
