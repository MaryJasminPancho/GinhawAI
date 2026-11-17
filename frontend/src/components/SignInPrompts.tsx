import Link from "next/link";
import { buttonClasses } from "@/components/Button";
import { Lang } from "@/lib/api";
import { t } from "@/lib/i18n";

// For citizens who aren't signed in (3rd consultation): checking eligibility stays open to
// everyone; following through (emailing results, tracking applications, reminders, keeping the
// checklist) needs a free account. These show what is locked and where to sign in.

/** The account-only features, shown greyed out with a lock, and one button to sign in. */
export function LockedFeatures({ lang, href }: { lang: Lang; href: string }) {
  const items = ["lockedEmail", "lockedTracker", "lockedReminders", "lockedChecklist"] as const;
  return (
    <section className="relative z-10 mt-6 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5 print:hidden dark:bg-white/4 dark:ring-white/10">
      <h2 className="text-[0.9375rem] font-semibold text-gray-900 dark:text-white">{t(lang, "lockedTitle")}</h2>
      <p className="mt-1 text-[0.8125rem] leading-relaxed text-gray-600 dark:text-gray-300">{t(lang, "lockedIntro")}</p>
      <ul className="mt-3 space-y-2">
        {items.map((k) => (
          <li key={k} className="flex items-start gap-3 rounded-xl bg-gray-50 p-3 text-[0.8125rem] text-gray-500 dark:bg-white/[0.03] dark:text-gray-400">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mt-0.5 shrink-0" aria-hidden="true">
              <rect x="4" y="11" width="16" height="10" rx="2" />
              <path d="M8 11V7a4 4 0 0 1 8 0v4" />
            </svg>
            <span>{t(lang, k)}</span>
          </li>
        ))}
      </ul>
      <Link href={href} className={buttonClasses("primary", "mt-4 w-full text-center")}>
        {t(lang, "lockedButton")}
      </Link>
    </section>
  );
}

/** A one-line prompt at the moment an account would help (a paper ticked, the plan opened). */
export function SignInNudge({ lang, href, text }: { lang: Lang; href: string; text: "nudgeTicks" | "nudgePlan" }) {
  return (
    <Link
      href={href}
      className="block rounded-2xl bg-brand-50 px-4 py-3 text-[0.8125rem] leading-relaxed text-brand-900 ring-1 ring-brand-200 transition hover:bg-brand-100 print:hidden dark:bg-brand-500/10 dark:text-brand-200 dark:ring-brand-500/20"
    >
      {t(lang, text)} <span className="font-semibold underline">{t(lang, "lockedButton")} →</span>
    </Link>
  );
}

/** Where "Log in" goes from a results or plan page: sign up (or log in), keep this check, come back here. */
export const signInHref = (lang: Lang, sessionId: string, back: string) =>
  `/account?lang=${lang}&mode=signup&claim=${sessionId}&next=${encodeURIComponent(back)}`;
