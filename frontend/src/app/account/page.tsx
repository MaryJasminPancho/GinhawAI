"use client";

import Link from "next/link";
import Script from "next/script";
import { FormEvent, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Backdrop from "@/components/Backdrop";
import PageHeader from "@/components/PageHeader";
import Button, { buttonClasses } from "@/components/Button";
import { citizenGoogle, citizenLogin, citizenSignup, claimSession, getCitizenConfig, getCitizenToken, Lang } from "@/lib/api";
import { LANG_LABELS, t } from "@/lib/i18n";

// Optional citizen account (2nd consultation): log in or sign up with a username and
// password, or with Google. The chat works without any of this.

type GoogleId = {
  accounts: { id: { initialize: (o: object) => void; renderButton: (el: HTMLElement, o: object) => void } };
};
declare global {
  interface Window {
    google?: GoogleId;
  }
}

const LANGS: Lang[] = ["fil", "ceb", "en"];
const field =
  "w-full rounded-2xl bg-white px-4 py-3 text-[0.9375rem] text-gray-900 ring-1 ring-gray-200 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-white/5 dark:text-gray-100 dark:ring-white/10";

function AccountInner() {
  const router = useRouter();
  const params = useSearchParams();
  const p = params.get("lang");
  const next = params.get("next") || "/me";
  const claim = params.get("claim"); // session to keep, when signing up from the results page
  const [lang, setLang] = useState<Lang>(p === "fil" || p === "ceb" ? p : "en");
  const [mode, setMode] = useState<"login" | "signup">(params.get("mode") === "signup" ? "signup" : "login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [googleId, setGoogleId] = useState<string | null>(null);
  const [scriptReady, setScriptReady] = useState(false);
  const [needsConsent, setNeedsConsent] = useState(false);
  const googleBox = useRef<HTMLDivElement>(null);
  const consentRef = useRef(consent); // read by the Google callback, which is set up once
  useEffect(() => {
    consentRef.current = consent;
  }, [consent]);

  const done = useCallback(async () => {
    if (claim) await claimSession(claim).catch(() => {}); // an expired session just isn't kept
    router.replace(`${next}${next.includes("?") ? "&" : "?"}lang=${lang}`);
  }, [router, next, lang, claim]);

  useEffect(() => {
    if (getCitizenToken()) void done();
    getCitizenConfig()
      .then((c) => setGoogleId(c.google_client_id))
      .catch(() => setGoogleId(null));
  }, [done]);

  // "Continue with Google" (Google Identity Services); shown only when the backend has a client ID.
  useEffect(() => {
    if (!googleId || !scriptReady || !window.google || !googleBox.current) return;
    window.google.accounts.id.initialize({
      client_id: googleId,
      callback: async (r: { credential: string }) => {
        setError(null);
        try {
          await citizenGoogle(r.credential, consentRef.current);
          await done();
        } catch (e) {
          if ((e as Error).message === "consent_required") {
            setNeedsConsent(true);
            setMode("signup");
          } else setError((e as Error).message);
        }
      },
    });
    googleBox.current.innerHTML = "";
    window.google.accounts.id.renderButton(googleBox.current, { theme: "outline", size: "large", shape: "pill", text: "continue_with", width: 320 });
  }, [googleId, scriptReady, done]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "signup") await citizenSignup(username.trim(), password, name.trim(), consent);
      else await citizenLogin(username.trim(), password);
      await done();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const tab = (m: "login" | "signup") =>
    `flex-1 rounded-full py-2 text-sm font-semibold transition ${mode === m ? "bg-brand-700 text-white shadow-sm" : "text-gray-600 hover:text-gray-900 dark:text-gray-300"}`;

  return (
    <div className="relative isolate min-h-screen overflow-hidden bg-white dark:bg-[#0a0f0c] sm:flex sm:items-center sm:justify-center sm:p-6 lg:p-10">
      <Backdrop />
      {googleId && <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onReady={() => setScriptReady(true)} />}
      <main className="relative mx-auto flex min-h-screen w-full max-w-md flex-col p-5 text-gray-900 dark:text-gray-100 sm:min-h-0 sm:max-w-xl sm:rounded-4xl sm:bg-white/80 sm:p-8 sm:shadow-2xl sm:shadow-brand-900/15 sm:ring-1 sm:ring-black/5 sm:backdrop-blur-xl dark:sm:bg-white/4 dark:sm:ring-white/10">
        <PageHeader title={t(lang, "acctTitle")} subtitle={LANG_LABELS[lang]} />

        <div className="relative z-10 mt-5 space-y-4">
          <div role="group" aria-label="Language" className="flex gap-1.5">
            {LANGS.map((l) => (
              <button key={l} type="button" onClick={() => setLang(l)} className={`rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ${lang === l ? "bg-brand-700 text-white ring-brand-700" : "bg-white text-gray-600 ring-gray-200 dark:bg-white/5 dark:text-gray-300 dark:ring-white/10"}`}>
                {LANG_LABELS[l]}
              </button>
            ))}
          </div>

          <p className="rounded-2xl bg-brand-50 px-4 py-3 text-sm leading-relaxed text-brand-900 ring-1 ring-brand-200 dark:bg-brand-500/10 dark:text-brand-200 dark:ring-brand-500/20">{t(lang, "acctWhy")}</p>

          <div role="tablist" className="flex gap-1 rounded-full bg-gray-100 p-1 dark:bg-white/5">
            <button role="tab" aria-selected={mode === "login"} type="button" className={tab("login")} onClick={() => setMode("login")}>
              {t(lang, "acctLogin")}
            </button>
            <button role="tab" aria-selected={mode === "signup"} type="button" className={tab("signup")} onClick={() => setMode("signup")}>
              {t(lang, "acctSignup")}
            </button>
          </div>

          <form onSubmit={submit} className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-sm font-medium">{t(lang, "acctUsername")}</span>
              <input className={field} autoComplete="username" required minLength={4} maxLength={40} value={username} onChange={(e) => setUsername(e.target.value)} />
              {mode === "signup" && <span className="mt-1 block text-xs text-gray-500">{t(lang, "acctUserHint")}</span>}
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium">{t(lang, "acctPassword")}</span>
              <input className={field} type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} required minLength={mode === "signup" ? 8 : 1} maxLength={200} value={password} onChange={(e) => setPassword(e.target.value)} />
              {mode === "signup" && <span className="mt-1 block text-xs text-gray-500">{t(lang, "acctPassHint")}</span>}
            </label>
            {mode === "signup" && (
              <label className="block">
                <span className="mb-1 block text-sm font-medium">{t(lang, "acctName")}</span>
                <input className={field} autoComplete="given-name" maxLength={100} value={name} onChange={(e) => setName(e.target.value)} />
              </label>
            )}
            {mode === "signup" && (
              <label className="flex items-start gap-3 rounded-2xl bg-white p-3 text-sm leading-relaxed ring-1 ring-gray-200 dark:bg-white/5 dark:ring-white/10">
                <input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-brand-600" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                <span>{t(lang, "acctConsent")}</span>
              </label>
            )}
            {needsConsent && <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-500/20">{t(lang, "acctGoogleConsent")}</p>}
            {error && <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</p>}
            <Button type="submit" className="w-full" disabled={busy || (mode === "signup" && !consent)}>
              {busy ? t(lang, "loading") : t(lang, mode === "signup" ? "acctSignup" : "acctLogin")}
            </Button>
          </form>

          {googleId && (
            <>
              <div className="flex items-center gap-3 text-xs text-gray-400">
                <span className="h-px flex-1 bg-gray-200 dark:bg-white/10" />
                {t(lang, "acctOr")}
                <span className="h-px flex-1 bg-gray-200 dark:bg-white/10" />
              </div>
              <div ref={googleBox} className="flex justify-center" />
            </>
          )}

          <Link href={`/chat?lang=${lang}`} className={buttonClasses("ghost", "w-full")}>
            {t(lang, "acctNoAccount")}
          </Link>
        </div>
      </main>
    </div>
  );
}

export default function AccountPage() {
  return (
    <Suspense>
      <AccountInner />
    </Suspense>
  );
}
