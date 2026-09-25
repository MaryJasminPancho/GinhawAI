"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Backdrop from "@/components/Backdrop";
import Button from "@/components/Button";
import ThemeToggle from "@/components/ThemeToggle";
import { clearAdminSession, DEMO_ACCOUNTS, LIVE, login } from "@/lib/adminApi";
import { inputClass } from "@/components/admin/ui";

// Staff sign-in ("Log into Administrative Console / Executive Dashboard / System
// Console" in the use case diagrams). Uses the same centered card as the citizen
// splash screen so both sides of GinhawAI feel like one product.

function LoginInner() {
  const router = useRouter();
  const next = useSearchParams().get("next");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"password" | "otp">("password");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const goNext = () => router.replace(next && next.startsWith("/admin") ? next : "/admin");

  async function handlePassword(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(username, password);
      // Multi-Factor OTP Verification (module list). The backend has no OTP
      // endpoint yet, so this step only appears in mock mode. CHECK
      if (!LIVE.auth) setStep("otp");
      else goNext();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  function handleOtp(e: FormEvent) {
    e.preventDefault();
    if (!/^\d{6}$/.test(otp)) {
      setError("Enter the 6-digit code.");
      return;
    }
    goNext();
  }

  function cancelOtp() {
    clearAdminSession();
    setOtp("");
    setStep("password");
  }

  return (
    <div className="relative isolate min-h-screen overflow-hidden bg-white dark:bg-[#0a0f0c] sm:flex sm:items-center sm:justify-center sm:p-6 lg:p-10">
      <Backdrop />

      <main className="relative mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-8 p-6 text-gray-900 dark:text-gray-100 sm:min-h-0 sm:rounded-[32px] sm:bg-white/70 sm:p-10 sm:shadow-2xl sm:shadow-brand-950/10 sm:ring-1 sm:ring-black/5 sm:backdrop-blur-xl dark:sm:bg-white/[0.04] dark:sm:ring-white/10">
        <div className="absolute right-4 top-4">
          <ThemeToggle />
        </div>

        <div className="flex flex-col items-center gap-4 text-center">
          <div className="rounded-[24px] bg-white p-3 shadow-sm ring-1 ring-black/5">
            <Image src="/logo.png" alt="GinhawAI" width={243} height={313} priority className="h-20 w-auto" />
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-brand-100/80 px-3 py-1 text-xs font-medium text-brand-800 dark:bg-brand-500/10 dark:text-brand-300">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-600 dark:bg-brand-400" />
            Authorized personnel only
          </div>
          <div className="space-y-1.5">
            <h1 className="text-2xl font-bold tracking-tight">{step === "password" ? "Staff sign in" : "Verify it's you"}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {step === "password" ? "LGU welfare personnel, executives and system administrators." : "Enter the 6-digit code sent to your registered mobile number."}
            </p>
          </div>
        </div>

        {step === "password" ? (
          <form onSubmit={handlePassword} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="username" className="block text-xs font-semibold text-gray-600 dark:text-gray-300">
                Username
              </label>
              <input id="username" autoComplete="username" required value={username} onChange={(e) => setUsername(e.target.value)} className={`${inputClass} py-3`} />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="password" className="block text-xs font-semibold text-gray-600 dark:text-gray-300">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`${inputClass} py-3 pr-16`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-2 my-auto h-7 rounded-lg px-2 text-xs font-semibold text-brand-700 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-white/5"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-[13px] text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</p>}

            <Button type="submit" disabled={busy} className="w-full">
              {busy ? "Signing in…" : "Sign in"}
            </Button>
            <p className="text-center text-xs text-gray-400 dark:text-gray-500">Forgot your password? Ask your System Administrator to reset it.</p>
          </form>
        ) : (
          <form onSubmit={handleOtp} className="space-y-4">
            <input
              aria-label="6-digit code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              autoFocus
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              className={`${inputClass} py-3 text-center text-2xl font-bold tracking-[0.5em]`}
            />
            {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-[13px] text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</p>}
            <Button type="submit" className="w-full">
              Verify and continue
            </Button>
            <Button type="button" variant="ghost" className="w-full" onClick={cancelOtp}>
              Use a different account
            </Button>
            <p className="text-center text-xs text-gray-400 dark:text-gray-500">Demo mode: any 6 digits will work.</p>
          </form>
        )}

        {!LIVE.auth && step === "password" && (
          <details className="rounded-2xl bg-brand-50/70 p-4 text-[13px] ring-1 ring-brand-100 dark:bg-white/[0.04] dark:ring-white/10">
            <summary className="cursor-pointer font-semibold text-brand-800 dark:text-brand-300">Demo accounts (mock mode)</summary>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Password for all: <code className="font-mono font-semibold">ginhawai123</code>
            </p>
            <ul className="mt-2 space-y-1">
              {DEMO_ACCOUNTS.map((a) => (
                <li key={a.username}>
                  <button
                    type="button"
                    onClick={() => {
                      setUsername(a.username);
                      setPassword("ginhawai123");
                    }}
                    className="flex w-full items-center justify-between rounded-lg px-2 py-1 text-left hover:bg-white dark:hover:bg-white/5"
                  >
                    <code className="font-mono text-gray-800 dark:text-gray-200">{a.username}</code>
                    <span className="text-xs text-gray-500 dark:text-gray-400">{a.role}</span>
                  </button>
                </li>
              ))}
            </ul>
          </details>
        )}

        <Link href="/" className="text-center text-xs font-medium text-gray-400 hover:text-brand-700 dark:text-gray-500 dark:hover:text-brand-300">
          ← Back to the citizen app
        </Link>
      </main>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}
