"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import type { Lang } from "@/lib/api";

const noop = () => () => {};

// A short "Saved" pill at the bottom of the screen after a change saves on its own (application
// tracker, document ticks). Without it a tap saved silently and a misclick went unnoticed.

const TEXT: Record<Lang, string> = { en: "Saved", fil: "Na-save", ceb: "Na-save" };
const SHOW_MS = 2000;

export function useSavedToast(lang: Lang) {
  const [shown, setShown] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flash = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setShown(true);
    timer.current = setTimeout(() => setShown(false), SHOW_MS);
  }, []);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  // Rendered into <body>: a card with backdrop-blur would otherwise trap the fixed pill inside it.
  const onClient = useSyncExternalStore(noop, () => true, () => false);
  const toast = onClient && createPortal(
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4 print:hidden">
      {shown && (
        <span className="flex items-center gap-1.5 rounded-full bg-gray-900 px-4 py-2 text-sm font-semibold text-white shadow-lg dark:bg-white dark:text-gray-900">
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12l5 5L20 7" />
          </svg>
          {TEXT[lang] ?? TEXT.en}
        </span>
      )}
    </div>,
    document.body,
  );
  return { flash, toast };
}
