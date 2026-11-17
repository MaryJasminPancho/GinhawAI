"use client";

import Image from "next/image";
import Link from "next/link";
import Backdrop from "@/components/Backdrop";
import Button, { buttonClasses } from "@/components/Button";

// Shown when a page crashes while it is running (instead of the framework's raw error screen).
// "Try again" re-draws the page; the home link is the safe way out. The technical details are
// not shown to citizens.
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="relative isolate flex min-h-screen flex-col items-center justify-center overflow-hidden bg-white p-5 dark:bg-[#0a0f0c]">
      <Backdrop />
      <main role="alert" className="relative mx-auto flex w-full max-w-md flex-col items-center gap-6 p-6 text-center text-gray-900 sm:rounded-4xl sm:bg-white/80 sm:p-10 sm:shadow-2xl sm:shadow-brand-900/15 sm:ring-1 sm:ring-black/5 sm:backdrop-blur-xl dark:text-gray-100">
        <div className="rounded-3xl bg-white p-3 shadow-lg shadow-brand-900/10 ring-1 ring-black/5">
          <Image src="/logo.png" alt="GinhawAI" width={243} height={313} className="h-20 w-auto" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">Something went wrong</h1>
          <p className="text-[0.9375rem] leading-relaxed text-gray-600 dark:text-gray-300">Sorry, this page could not load. Please try again. If it keeps happening, start again from the home page.</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">May nangyaring problema. · Naay problema nga nahitabo.</p>
        </div>
        <div className="flex w-full flex-col gap-3">
          <Button onClick={reset} className="w-full">
            Try again
          </Button>
          <Link href="/" className={buttonClasses("secondary", "w-full text-center")}>
            Go to the home page
          </Link>
        </div>
      </main>
    </div>
  );
}
