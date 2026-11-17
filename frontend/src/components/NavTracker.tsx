"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

// Counts the GinhawAI pages opened in this browser tab, so the Back button knows whether there
// is an earlier GinhawAI page to return to (the browser's "referrer" is only set when the tab
// first loads, so it cannot tell this after the person has moved around the app).
export const NAV_COUNT_KEY = "ginhawai-pages";
const NAV_LAST_KEY = "ginhawai-last-path";

export default function NavTracker() {
  const pathname = usePathname();
  useEffect(() => {
    try {
      // Same path twice in a row (React dev double-run, query-only change) is not a new page
      if (sessionStorage.getItem(NAV_LAST_KEY) === pathname) return;
      sessionStorage.setItem(NAV_LAST_KEY, pathname);
      sessionStorage.setItem(NAV_COUNT_KEY, String(Number(sessionStorage.getItem(NAV_COUNT_KEY) || 0) + 1));
    } catch {
      // storage blocked: Back then falls back to the home page
    }
  }, [pathname]);
  return null;
}
