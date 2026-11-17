import Link from "next/link";
import type { Lang } from "@/lib/api";
import { t } from "@/lib/i18n";

/** Small site footer for citizen pages: Privacy Notice, Terms of Use and what GinhawAI is.
 * Not printed. Put it at the bottom of a page's card (or page) with a top margin. */
export default function SiteFooter({ lang = "en", className = "", replace = false }: { lang?: Lang; className?: string; replace?: boolean }) {
  const link = "inline-block px-1 py-2 font-medium text-gray-600 hover:text-brand-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:text-gray-300 dark:hover:text-brand-300";
  return (
    <footer className={`relative z-10 text-center text-xs text-gray-500 dark:text-gray-400 print:hidden ${className}`}>
      <nav aria-label="Legal" className="flex flex-wrap items-center justify-center gap-x-3">
        <Link href={`/privacy?lang=${lang}`} replace={replace} className={link}>
          {t(lang, "footerPrivacy")}
        </Link>
        <span aria-hidden="true">·</span>
        <Link href={`/terms?lang=${lang}`} replace={replace} className={link}>
          {t(lang, "footerTerms")}
        </Link>
      </nav>
      <p>© {new Date().getFullYear()} GinhawAI · {t(lang, "footerTagline")}</p>
    </footer>
  );
}
