import Link from "next/link";
import Backdrop from "@/components/Backdrop";
import PageHeader from "@/components/PageHeader";

// CHECK: the `code` values are sent to the backend as the session language.
// Make sure they match the codes in backend/db/seed_localization.sql.
const LANGUAGES = [
  { code: "fil", label: "Filipino", hint: "Tagalog" },
  { code: "ceb", label: "Bisaya", hint: "Cebuano" },
  { code: "en", label: "English", hint: "English" },
];

function ChevronIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

export default function LanguageSelection() {
  return (
    <div className="relative isolate min-h-screen overflow-hidden bg-white dark:bg-[#0a0f0c] sm:flex sm:items-center sm:justify-center sm:p-6 lg:p-10">
      <Backdrop />

      <main className="relative mx-auto flex min-h-screen w-full max-w-md flex-col p-5 text-gray-900 dark:text-gray-100 sm:min-h-0 sm:max-w-lg sm:rounded-[32px] sm:bg-white/70 sm:p-8 sm:shadow-2xl sm:shadow-brand-950/10 sm:ring-1 sm:ring-black/5 sm:backdrop-blur-xl dark:sm:bg-white/[0.04] dark:sm:ring-white/10">
        <PageHeader title="GinhawAI" step={1} totalSteps={4} />

        <div className="relative z-10 mt-10 flex flex-1 flex-col items-center justify-center gap-8 text-center sm:mt-8">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">
              Choose your language
            </h1>
            <p className="mt-1.5 text-[13px] text-gray-500 dark:text-gray-400">
              Piliin ang iyong wika &nbsp;·&nbsp; Pilia ang imong pinulongan
            </p>
          </div>

          <nav className="flex w-full flex-col gap-3">
            {LANGUAGES.map((l) => (
              <Link
                key={l.code}
                href={`/chat?lang=${l.code}`}
                className="group flex items-center justify-between rounded-2xl bg-white p-4 text-left shadow-sm ring-1 ring-black/5 transition hover:shadow-md hover:ring-brand-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:bg-white/[0.04] dark:ring-white/10 dark:hover:ring-brand-500/60"
              >
                <span>
                  <span className="block text-base font-semibold text-gray-900 dark:text-white">
                    {l.label}
                  </span>
                  <span className="block text-xs text-gray-400 dark:text-gray-500">{l.hint}</span>
                </span>
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-50 text-brand-700 transition group-hover:bg-brand-600 group-hover:text-white dark:bg-brand-500/10 dark:text-brand-300">
                  <ChevronIcon />
                </span>
              </Link>
            ))}
          </nav>
        </div>
      </main>
    </div>
  );
}