"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSyncExternalStore } from "react";
import { citizenLogout, getCitizenName, getCitizenToken, Lang, subscribeCitizen } from "@/lib/api";
import { t } from "@/lib/i18n";

// Top-of-page account buttons, where people expect them (like most websites): "Log in" and
// "Sign up", or "Hi, <name> · My account · Log out" once signed in. Both are 44px tall touch
// targets. "Get started" stays the one big primary button, because the account is optional.
// The login lasts 30 minutes; subscribeCitizen notices when it ends and the buttons change back.
const signedIn = () => (getCitizenToken() ? getCitizenName() || "" : null);

const base =
  "inline-flex min-h-11 flex-1 items-center justify-center whitespace-nowrap rounded-full px-5 text-sm font-semibold transition active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#0a0f0c] sm:flex-none";
const outline = `${base} border-2 border-brand-600 bg-white text-brand-700 hover:bg-brand-50 dark:border-brand-400 dark:bg-transparent dark:text-brand-300 dark:hover:bg-white/5`;
const solid = `${base} bg-brand-700 text-white shadow-sm hover:bg-brand-600`;

export default function AccountBar({ lang = "en" }: { lang?: Lang }) {
  const router = useRouter();
  const name = useSyncExternalStore(subscribeCitizen, signedIn, () => null);

  if (name === null) {
    return (
      <div className="flex w-full items-center gap-2 sm:w-auto">
        <Link href={`/account?lang=${lang}&mode=login`} className={outline}>
          {t(lang, "acctLogin")}
        </Link>
        <Link href={`/account?lang=${lang}&mode=signup`} className={solid}>
          {t(lang, "acctSignup")}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex w-full items-center gap-2 sm:w-auto">
      {name && <span className="hidden max-w-[10rem] truncate text-sm font-semibold text-gray-700 dark:text-gray-200 md:inline">{`${t(lang, "acctHi")}, ${name}`}</span>}
      <button
        type="button"
        className={outline}
        onClick={() => {
          citizenLogout();
          router.refresh();
        }}
      >
        {t(lang, "acctLogout")}
      </button>
    </div>
  );
}
