import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import Backdrop from "@/components/Backdrop";
import { buttonClasses } from "@/components/Button";
import SiteFooter from "@/components/SiteFooter";

export const metadata: Metadata = { title: "Page not found" };

// Shown for any address that does not exist. The language is not known here, so the message is
// given in all three languages, short and calm, with one clear way back.
export default function NotFound() {
  return (
    <div className="relative isolate flex min-h-screen flex-col overflow-hidden bg-white dark:bg-[#0a0f0c]">
      <Backdrop />
      <div className="flex flex-1 items-center justify-center p-5">
        <main className="relative mx-auto flex w-full max-w-md flex-col items-center gap-6 p-6 text-center text-gray-900 sm:rounded-4xl sm:bg-white/80 sm:p-10 sm:shadow-2xl sm:shadow-brand-900/15 sm:ring-1 sm:ring-black/5 sm:backdrop-blur-xl dark:text-gray-100">
          <div className="rounded-3xl bg-white p-3 shadow-lg shadow-brand-900/10 ring-1 ring-black/5">
            <Image src="/logo.png" alt="GinhawAI" width={243} height={313} className="h-20 w-auto" />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-semibold text-brand-700 dark:text-brand-300">404</p>
            <h1 className="text-2xl font-bold tracking-tight">We can&apos;t find that page</h1>
            <p className="text-[0.9375rem] leading-relaxed text-gray-600 dark:text-gray-300">The link may be old or mistyped. Nothing you entered was lost.</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Hindi makita ang pahinang ito. · Wala makit-i kini nga panid.</p>
          </div>
          <div className="flex w-full flex-col gap-3">
            <Link href="/" className={buttonClasses("primary", "w-full text-center")}>
              Go to the home page
            </Link>
            <Link href="/programs" className={buttonClasses("secondary", "w-full text-center")}>
              Browse programs
            </Link>
          </div>
        </main>
      </div>
      <SiteFooter className="px-4 pb-5 pt-2" />
    </div>
  );
}
