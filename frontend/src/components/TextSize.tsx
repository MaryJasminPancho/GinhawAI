"use client";

import { useSyncExternalStore } from "react";

// Larger text for citizens with poor eyesight (many are seniors). The level is a
// data-text-size attribute on <html> (see globals.css); citizen pages size their text
// in rem, so everything grows together. Saved per device in localStorage.
export const TEXT_SIZES = [100, 115, 130, 150]; // % of the normal size
const KEY = "textSize";

function subscribe(callback: () => void) {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-text-size"] });
  return () => observer.disconnect();
}
const getSnapshot = () => Number(document.documentElement.dataset.textSize ?? 0);
const getServerSnapshot = () => 0;

function apply(level: number) {
  document.documentElement.dataset.textSize = String(level);
  try {
    localStorage.setItem(KEY, String(level));
  } catch {
    // Storage can be blocked (private mode); the size just won't be remembered.
  }
}

/** A− / A+ buttons. Shown on every citizen screen. */
export default function TextSize() {
  const level = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const max = TEXT_SIZES.length - 1;
  const btn =
    "flex h-8 min-w-9 items-center justify-center rounded-full px-2 font-bold text-gray-700 transition hover:bg-brand-50 hover:text-brand-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:pointer-events-none disabled:opacity-35 dark:text-gray-200 dark:hover:bg-white/10";

  return (
    <div
      role="group"
      aria-label={`Text size, ${TEXT_SIZES[level]}%`}
      className="inline-flex items-center rounded-full border border-gray-200/80 bg-white/80 p-0.5 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5"
    >
      <button type="button" className={`${btn} text-[13px]`} onClick={() => apply(level - 1)} disabled={level <= 0} aria-label="Smaller text" title="Smaller text">
        A−
      </button>
      <span aria-hidden="true" className="h-4 w-px bg-gray-200 dark:bg-white/10" />
      <button type="button" className={`${btn} text-[17px]`} onClick={() => apply(level + 1)} disabled={level >= max} aria-label="Bigger text" title="Bigger text">
        A+
      </button>
    </div>
  );
}
