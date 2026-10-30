"use client";

import { useRouter } from "next/navigation";

/** "← Back": returns to the previous GinhawAI page, or to `fallback` when the page
 * was opened directly (from a link, bookmark or a new tab). */
export default function BackButton({ fallback = "/" }: { fallback?: string }) {
  const router = useRouter();

  function back() {
    const cameFromHere = document.referrer.startsWith(window.location.origin);
    if (cameFromHere && window.history.length > 1) router.back();
    else router.push(fallback);
  }

  return (
    <button
      type="button"
      onClick={back}
      aria-label="Back"
      title="Back"
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/80 text-gray-700 shadow-sm ring-1 ring-black/5 transition hover:bg-brand-50 hover:text-brand-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:bg-white/5 dark:text-gray-200 dark:ring-white/10 dark:hover:bg-white/10"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M15 18l-6-6 6-6" />
      </svg>
    </button>
  );
}
