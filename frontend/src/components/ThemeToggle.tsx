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

  const base =
    "px-3 py-1.5 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600";
  const on = "bg-green-700 text-white dark:bg-green-600";
  const off =
    "bg-white text-gray-700 hover:bg-gray-100 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800";

  return (
    <div
      role="group"
      aria-label="Color theme"
      className="inline-flex overflow-hidden rounded-lg border border-gray-300 dark:border-gray-700"
    >
      <button
        type="button"
        aria-pressed={!isDark}
        onClick={() => choose(false)}
        className={`${base} ${!isDark ? on : off}`}
      >
        Light
      </button>
      <button
        type="button"
        aria-pressed={isDark}
        onClick={() => choose(true)}
        className={`${base} ${isDark ? on : off}`}
      >
        Dark
      </button>
    </div>
  );
}