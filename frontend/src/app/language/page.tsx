import Image from "next/image";
import Link from "next/link";

// CHECK: the `code` values are sent to the backend as the session language.
// Make sure they match the codes in backend/db/seed_localization.sql.
const LANGUAGES = [
  { code: "fil", label: "Filipino", hint: "Tagalog" },
  { code: "ceb", label: "Bisaya", hint: "Cebuano" },
  { code: "en", label: "English", hint: "English" },
];

export default function LanguageSelection() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-8 p-6 text-gray-900 dark:text-gray-100">
      {/* White tile keeps the logo's white background looking intentional in dark mode */}
      <div className="rounded-xl bg-white p-2 shadow-sm">
        <Image
          src="/logo.png"
          alt="GinhawAI"
          width={243}
          height={313}
          priority
          className="h-32 w-auto"
        />
      </div>

      <div className="text-center">
        <h1 className="text-2xl font-bold text-green-800 dark:text-green-400">
          Choose your language
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Piliin ang iyong wika · Pilia ang imong pinulongan
        </p>
      </div>

      <nav className="flex w-full flex-col gap-3">
        {LANGUAGES.map((l) => (
          <Link
            key={l.code}
            href={`/chat?lang=${l.code}`}
            className="rounded-xl border border-gray-300 bg-white px-5 py-4 text-center transition hover:border-green-600 hover:bg-green-50 focus:outline-none focus:ring-2 focus:ring-green-600 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-green-500 dark:hover:bg-gray-800"
          >
            <span className="block text-lg font-semibold">{l.label}</span>
            <span className="block text-xs text-gray-500 dark:text-gray-400">
              {l.hint}
            </span>
          </Link>
        ))}
      </nav>
    </main>
  );
}