"use client";

import { useSyncExternalStore } from "react";

// Reads whether <html> currently has the "dark" class, and re-renders when it changes.
function subscribe(callback: () => void) {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
  return () => observer.disconnect();
}
const getSnapshot = () => document.documentElement.classList.contains("dark");
const getServerSnapshot = () => false;

export default function ThemeToggle() {
  const isDark = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  function choose(dark: boolean) {
    document.documentElement.classList.toggle("dark", dark);
    try {
      localStorage.setItem("theme", dark ? "dark" : "light");
    } catch {
      // Storage can be blocked (private mode); the choice just won't be remembered.
    }
  }

  const pill =
    "rounded-full px-3 py-1.5 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500";
  const on = "bg-brand-700 text-white shadow-sm dark:bg-brand-600";
  const off = "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200";

  return (
    <div
      role="group"
      aria-label="Color theme"
      className="inline-flex rounded-full border border-gray-200/80 bg-white/80 p-0.5 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5"
    >
      <button type="button" aria-pressed={!isDark} onClick={() => choose(false)} className={`${pill} ${!isDark ? on : off}`}>
        Light
      </button>
      <button type="button" aria-pressed={isDark} onClick={() => choose(true)} className={`${pill} ${isDark ? on : off}`}>
        Dark
      </button>
    </div>
  );
}