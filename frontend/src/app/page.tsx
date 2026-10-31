import Image from "next/image";
import Link from "next/link";
import AccountLink from "@/components/AccountLink";
import Backdrop from "@/components/Backdrop";
import { buttonClasses } from "@/components/Button";
import TextSize from "@/components/TextSize";
import ThemeToggle from "@/components/ThemeToggle";

const STEPS = [
  { title: "Answer a few questions", text: "Chat in Filipino, Bisaya or English. About 3 minutes." },
  { title: "See your result", text: "Your vulnerability score, with the reasons behind it." },
  { title: "Know where to go", text: "Programs you may qualify for, the documents to bring, and the nearest office." },
];

export default function SplashScreen() {
  return (
    // Phones: the whole viewport, edge to edge. Tablet: a centered card.
    // Desktop (lg): a wide card with the intro on the left and how it works on the right.
    <div className="relative isolate min-h-screen overflow-hidden bg-white dark:bg-[#0a0f0c] sm:flex sm:items-center sm:justify-center sm:p-6 lg:p-10">
      <Backdrop />

      <main className="relative mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center gap-9 p-6 text-center text-gray-900 dark:text-gray-100 sm:min-h-0 sm:max-w-lg sm:rounded-[32px] sm:bg-white/80 sm:p-12 sm:shadow-2xl sm:shadow-brand-900/15 sm:ring-1 sm:ring-black/5 sm:backdrop-blur-xl dark:sm:bg-white/[0.04] dark:sm:ring-white/10 lg:grid lg:max-w-5xl lg:grid-cols-[1.1fr_1fr] lg:items-center lg:gap-14 lg:p-14 lg:text-left">
        <div className="absolute right-4 top-4 flex items-center gap-2">
          <TextSize />
          <ThemeToggle />
        </div>

        <div className="flex flex-col items-center gap-9 lg:items-start">
          <div className="flex flex-col items-center gap-4 lg:items-start">
            <div className="rounded-[28px] bg-white p-4 shadow-lg shadow-brand-900/10 ring-1 ring-black/5">
              <Image src="/logo.png" alt="GinhawAI" width={243} height={313} priority className="h-28 w-auto sm:h-32" />
            </div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold text-brand-800 ring-1 ring-brand-200 dark:bg-brand-500/10 dark:text-brand-300 dark:ring-brand-500/20">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-500 dark:bg-brand-400" />
              LGU-assisted welfare assessment
            </div>
          </div>

          <div className="space-y-3">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-[1.75rem] lg:text-[2.5rem] lg:leading-[1.1]">
              Find support you
              <br />
              <span className="bg-gradient-to-r from-brand-600 via-brand-500 to-teal-500 bg-clip-text text-transparent dark:from-brand-300 dark:via-brand-400 dark:to-teal-300">may qualify for</span>
            </h1>
            <p className="mx-auto max-w-[17.5rem] text-[0.9375rem] leading-relaxed text-gray-600 dark:text-gray-400 sm:max-w-[20rem] lg:mx-0 lg:max-w-md lg:text-[1.0625rem]">
              Answer a few quick questions and we&apos;ll match you with programs like 4Ps, AICS, and TUPAD.
            </p>
          </div>

          <div className="flex w-full flex-col items-center gap-3 lg:max-w-sm lg:items-start">
            <Link href="/language" className={buttonClasses("primary", "w-full")}>
              Get started
            </Link>
            <Link href="/programs" className="text-sm font-semibold text-brand-700 hover:underline dark:text-brand-300">
              Or browse all programs first
            </Link>
            <AccountLink />
            <p className="text-xs text-gray-500 dark:text-gray-500">Takes about 3 minutes · Fil · Bisaya · English</p>
          </div>
        </div>

        {/* How it works: desktop only, the phone layout stays short */}
        <ol className="hidden space-y-3 lg:block">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex gap-4 rounded-3xl bg-white/90 p-5 shadow-sm ring-1 ring-black/5 dark:bg-white/[0.05] dark:ring-white/10">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-400 to-brand-700 text-[0.9375rem] font-bold text-white shadow-md shadow-brand-600/30">
                {i + 1}
              </span>
              <div>
                <p className="text-[0.9375rem] font-semibold text-gray-900 dark:text-white">{s.title}</p>
                <p className="mt-0.5 text-sm leading-relaxed text-gray-600 dark:text-gray-400">{s.text}</p>
              </div>
            </li>
          ))}
          <li className="flex items-center gap-2 rounded-3xl bg-amber-50 px-5 py-3.5 text-sm text-amber-900 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-500/20">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            No account needed: without one, answers are deleted after your session. An optional account keeps them for you.
          </li>
        </ol>
      </main>
    </div>
  );
}
