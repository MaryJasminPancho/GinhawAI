"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { getCitizenName, getCitizenToken, Lang } from "@/lib/api";
import { t } from "@/lib/i18n";

// "Log in or sign up (optional)", or "Hi, Maria · My account" once signed in.
// Reads the device's saved login, so it renders only in the browser.
const noop = () => () => {};
const signedIn = () => (getCitizenToken() ? getCitizenName() || "" : null);

export default function AccountLink({ lang = "en", className = "" }: { lang?: Lang; className?: string }) {
  const name = useSyncExternalStore(noop, signedIn, () => null);
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
