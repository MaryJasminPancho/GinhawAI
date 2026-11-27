"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

// Keeps <html lang> in step with the language the citizen chose, so screen readers pronounce the
// page correctly and browsers do not offer to "translate" it. The language arrives as ?lang= on
// the first pages (chat, programs, privacy...); it is remembered for this tab, so pages reached
// by a session link (results, plan...) use it too. The home page and the staff console stay English.
const LANG_KEY = "ginhawai-lang";

// The language chosen earlier in this tab, for pages that can no longer read it from the session
// (e.g. "Your session has ended" after Finish).
export function rememberedLang(): "en" | "fil" | "ceb" {
  try {
    const saved = sessionStorage.getItem(LANG_KEY);
    return saved === "fil" || saved === "ceb" ? saved : "en";
  } catch {
    return "en";
  }
}

export default function LangSync() {
  const pathname = usePathname();
  useEffect(() => {
    let lang = "en";
    try {
      const p = new URLSearchParams(window.location.search).get("lang");
      if (p === "fil" || p === "ceb" || p === "en") sessionStorage.setItem(LANG_KEY, p);
      const saved = sessionStorage.getItem(LANG_KEY);
      if (pathname !== "/" && !pathname.startsWith("/admin") && (saved === "fil" || saved === "ceb")) lang = saved;
    } catch {
      // storage blocked: stay on English
    }
    document.documentElement.lang = lang;
  }, [pathname]);
  return null;
}
