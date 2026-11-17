"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { citizenIdleLogout, citizenLogout, citizenSecondsLeft, getCitizenToken, Lang, refreshCitizen, subscribeCitizen } from "@/lib/api";
import { t } from "@/lib/i18n";

// Signs a citizen out after they have been inactive, and keeps them signed in while they are active.
//  - Any tap, key press, scroll or mouse move counts as activity.
//  - While active, the 15-minute login token is swapped for a fresh one before it runs out
//    (so a person who is busy using the site is never signed out).
//  - After IDLE_MS of no activity, a "Are you still there?" box counts down WARN_SECONDS.
//    "Stay signed in" keeps the login; at zero the citizen is signed out.
// Only for signed-in citizens (guests have no login). Staff use a separate login.
const IDLE_MS = 5 * 60 * 1000;
const WARN_SECONDS = 60;
const REFRESH_WHEN_LEFT = 10 * 60; // seconds of token life left at which an active citizen gets a fresh token
const ACTIVITY_EVENTS = ["pointerdown", "keydown", "scroll", "touchstart", "mousemove"] as const;

export default function IdleGuard() {
  const signedIn = useSyncExternalStore(subscribeCitizen, () => !!getCitizenToken(), () => false);
  const [warnLeft, setWarnLeft] = useState<number | null>(null); // seconds left on the warning box, null = not showing
  const lastActive = useRef(Date.now());
  const warnUntil = useRef<number | null>(null);
  const refreshing = useRef(false);

  useEffect(() => {
    if (!signedIn) return;
    lastActive.current = Date.now();
    // While the warning box is open, activity does not count: only its buttons answer it.
    const onActivity = () => {
      if (warnUntil.current === null) lastActive.current = Date.now();
    };
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));

    const tick = () => {
      const now = Date.now();
      if (warnUntil.current !== null) {
        const left = Math.ceil((warnUntil.current - now) / 1000);
        if (left <= 0) {
          warnUntil.current = null;
          setWarnLeft(null);
          citizenIdleLogout();
        } else {
          setWarnLeft(left);
        }
        return;
      }
      if (now - lastActive.current >= IDLE_MS) {
        warnUntil.current = now + WARN_SECONDS * 1000;
        setWarnLeft(WARN_SECONDS);
        return;
      }
      // Active: renew the token a few minutes before it would run out
      const secs = citizenSecondsLeft();
      if (secs !== null && secs <= REFRESH_WHEN_LEFT && !refreshing.current) {
        refreshing.current = true;
        refreshCitizen()
          .catch(() => {}) // if it fails, the token simply runs out and the citizen logs in again
          .finally(() => {
            refreshing.current = false;
          });
      }
    };
    const id = setInterval(tick, 1000);
    document.addEventListener("visibilitychange", tick); // a tab left in the background wakes up with the right state

    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, onActivity));
      warnUntil.current = null;
    };
  }, [signedIn]);

  function stay() {
    lastActive.current = Date.now();
    warnUntil.current = null;
    setWarnLeft(null);
    refreshCitizen().catch(() => {}); // a fresh token right away
  }

  function signOut() {
    warnUntil.current = null;
    setWarnLeft(null);
    citizenLogout();
  }

  if (!signedIn || warnLeft === null) return null;
  // The page language was set by LangSync (<html lang>)
  const htmlLang = typeof document !== "undefined" ? document.documentElement.lang : "en";
  const lang: Lang = htmlLang === "fil" || htmlLang === "ceb" ? htmlLang : "en";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-5 print:hidden">
      <div role="alertdialog" aria-modal="true" aria-labelledby="idle-title" className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-2xl dark:bg-gray-900 dark:text-gray-100">
        <h2 id="idle-title" className="text-xl font-bold text-gray-900 dark:text-white">
          {t(lang, "idleTitle")}
        </h2>
        <p className="mt-2 text-[0.9375rem] leading-relaxed text-gray-600 dark:text-gray-300">{t(lang, "idleText").replace("{s}", String(warnLeft))}</p>
        <button
          type="button"
          autoFocus
          onClick={stay}
          className="mt-5 w-full rounded-2xl bg-gradient-to-br from-brand-500 via-brand-600 to-brand-700 px-6 py-3.5 text-[1rem] font-semibold text-white shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
        >
          {t(lang, "idleStay")}
        </button>
        <button
          type="button"
          onClick={signOut}
          className="mt-2 w-full rounded-2xl px-6 py-3 text-[0.9375rem] font-medium text-gray-600 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:text-gray-300 dark:hover:bg-white/5"
        >
          {t(lang, "idleSignOut")}
        </button>
      </div>
    </div>
  );
}
