import Image from "next/image";
import Link from "next/link";
import Backdrop from "@/components/Backdrop";
import { buttonClasses } from "@/components/Button";
import ThemeToggle from "@/components/ThemeToggle";

export default function SplashScreen() {
  return (
    // On phones this fills the whole viewport edge-to-edge. From the sm:
    // breakpoint up (tablet/desktop) it centers the app as a card over a
    // full-bleed brand backdrop, instead of a skinny mobile column floating
    // in empty white space.
    <div className="relative isolate min-h-screen overflow-hidden bg-white dark:bg-[#0a0f0c] sm:flex sm:items-center sm:justify-center sm:p-6 lg:p-10">
      <Backdrop />

      <main className="relative mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center gap-9 p-6 text-center text-gray-900 dark:text-gray-100 sm:min-h-0 sm:max-w-lg sm:rounded-[32px] sm:bg-white/70 sm:p-12 sm:shadow-2xl sm:shadow-brand-950/10 sm:ring-1 sm:ring-black/5 sm:backdrop-blur-xl dark:sm:bg-white/[0.04] dark:sm:ring-white/10">
        <div className="absolute right-4 top-4">
          <ThemeToggle />
        </div>

        <div className="flex flex-col items-center gap-9">
          <div className="flex flex-col items-center gap-4">
            <div className="rounded-[28px] bg-white p-4 shadow-sm ring-1 ring-black/5">
              <Image
                src="/logo.png"
                alt="GinhawAI"
                width={243}
                height={313}
                priority
                className="h-28 w-auto sm:h-32"
              />
            </div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-brand-100/80 px-3 py-1 text-xs font-medium text-brand-800 dark:bg-brand-500/10 dark:text-brand-300">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-600 dark:bg-brand-400" />
              LGU-assisted welfare assessment
            </div>
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-[28px]">
              Find support you
              <br />
              may qualify for
            </h1>
            <p className="mx-auto max-w-[280px] text-[15px] leading-relaxed text-gray-500 dark:text-gray-400 sm:max-w-[320px]">
              Answer a few quick questions and we&apos;ll match you with programs like 4Ps, AICS, and TUPAD.
            </p>
          </div>

          <div className="flex w-full flex-col items-center gap-3">
            <Link href="/language" className={buttonClasses("primary", "w-full")}>
              Get started
            </Link>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Takes about 3 minutes · Fil · Bisaya · English
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}