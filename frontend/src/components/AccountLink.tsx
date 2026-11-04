"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { getCitizenName, getCitizenToken, Lang, subscribeCitizen } from "@/lib/api";
import { t } from "@/lib/i18n";

// "Log in or sign up (optional)", or "Hi, Maria · My account" once signed in.
// Reads this tab's saved login, so it renders only in the browser. subscribeCitizen re-checks
// on sign in / sign out and every 15 s, so the link changes by itself when the 30 minutes run out.
const signedIn = () => (getCitizenToken() ? getCitizenName() || "" : null);

export default function AccountLink({ lang = "en", className = "" }: { lang?: Lang; className?: string }) {
  const name = useSyncExternalStore(subscribeCitizen, signedIn, () => null);
  const cls = `text-sm font-semibold text-brand-700 hover:underline dark:text-brand-300 ${className}`;
  if (name === null) {
    return (
      <Link href={`/account?lang=${lang}`} className={cls}>
        {t(lang, "acctLoginOrSignup")}
      </Link>
    );
  }
  return (
    <Link href={`/me?lang=${lang}`} className={cls}>
      {name ? `${t(lang, "acctHi")}, ${name} · ` : ""}
      {t(lang, "acctMyAccount")}
    </Link>
  );
}
