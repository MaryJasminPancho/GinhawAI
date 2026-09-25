"use client";

import Link from "next/link";
import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Backdrop from "@/components/Backdrop";
import PageHeader from "@/components/PageHeader";
import ChatBubble, { Role, TypingBubble } from "@/components/ChatBubble";
import { buttonClasses } from "@/components/Button";
import { Lang, QuickReply, sendMessage, SessionExpiredError, startSession } from "@/lib/api";
import { LANG_LABELS, t } from "@/lib/i18n";

type Msg = { id: number; role: Role; text: string };


function ChatInner() {
  // Language page should link here as /chat?lang=fil | /chat?lang=ceb | /chat?lang=en
  const param = useSearchParams().get("lang");
  const lang: Lang = param === "fil" || param === "ceb" ? param : "en";

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [complete, setComplete] = useState(false);
  const [chips, setChips] = useState<QuickReply[]>([]);
  const [error, setError] = useState<string | null>(null);

  const nextId = useRef(0);
  const started = useRef(false); // stops React dev Strict Mode from creating 2 sessions
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const addMessage = (role: Role, text: string) =>
    setMessages((prev) => [...prev, { id: nextId.current++, role, text }]);

  // Start a session once when the page opens.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    startSession(lang)
      .then((s) => {
        setSessionId(s.session_id);
        s.messages.forEach((m) => addMessage("assistant", m));
        setChips(s.quick_replies);
      })
      .catch((e) => setError(e.message));
  }, [lang]);

  // Keep the newest message in view. Scrolls only the message list itself
  // (via scrollTop), not scrollIntoView — that call also "scrolls" ancestors
  // with overflow-hidden (like the h-screen <main> below), which silently
  // shifted the whole page up and pushed the header off-screen.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  async function send(text: string) {
    if (!text || !sessionId || sending || complete) return;
    setInput("");
    setError(null);
    setChips([]);
    addMessage("user", text);
    setSending(true);
    try {
      const res = await sendMessage(sessionId, text);
      addMessage("assistant", res.reply);
      setChips(res.quick_replies);
      if (res.is_complete) setComplete(true);
    } catch (e) {
      setError(e instanceof SessionExpiredError ? t(lang, "sessionEnded") : (e as Error).message);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    send(input.trim());
  }

  return (
    // On phones this is a full h-screen app (edge-to-edge, no page scroll).
    // From sm: up it becomes a fixed-height card (bounded, not stretched to
    // whatever the monitor's height is) centered over the full-bleed backdrop.
    <div className="relative isolate min-h-screen overflow-hidden bg-white dark:bg-[#0a0f0c] sm:flex sm:items-center sm:justify-center sm:p-6 lg:p-10">
      <Backdrop />

      <main className="relative mx-auto flex h-screen w-full max-w-md flex-col p-4 text-gray-900 dark:text-gray-100 sm:h-[min(760px,88vh)] sm:max-w-lg sm:rounded-[32px] sm:bg-white/70 sm:p-6 sm:shadow-2xl sm:shadow-brand-950/10 sm:ring-1 sm:ring-black/5 sm:backdrop-blur-xl dark:sm:bg-white/[0.04] dark:sm:ring-white/10">
        <PageHeader title={t(lang, "assessment")} subtitle={LANG_LABELS[lang]} step={2} totalSteps={4} />

        <div
          ref={scrollRef}
          className="relative z-10 mt-4 flex-1 space-y-4 overflow-y-auto rounded-3xl bg-white/70 p-4 shadow-sm ring-1 ring-black/5 backdrop-blur dark:bg-white/[0.03] dark:ring-white/10"
        >
          {messages.length === 0 && !error && (
            <p className="p-2 text-sm text-gray-400 dark:text-gray-500">
              {t(lang, "loading")}
            </p>
          )}
          {messages.map((m) => (
            <ChatBubble key={m.id} role={m.role} text={m.text} />
          ))}
          {sending && <TypingBubble />}
          {!sending && !complete && chips.length > 0 && (
            <div className="flex flex-wrap gap-2 pl-9" role="group" aria-label="Quick replies">
              {chips.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => send(c.label)}
                  className="rounded-full bg-white px-3.5 py-2 text-[13px] font-medium text-brand-800 shadow-sm ring-1 ring-brand-200 transition hover:bg-brand-50 active:scale-95 dark:bg-white/[0.04] dark:text-brand-300 dark:ring-brand-500/30 dark:hover:bg-white/10"
                >
                  {c.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {error && (
          <div className="relative z-10 mt-3 flex items-start gap-2 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-100 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-500/20">
            <svg className="mt-0.5 h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v5M12 16h.01" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {complete ? (
          <Link
            href={`/confirm?session=${sessionId}`}
            className={buttonClasses("primary", "mt-3 w-full text-center")}
          >
            {t(lang, "reviewAnswers")}
          </Link>
        ) : (
          <form onSubmit={handleSend} className="relative z-10 mt-3 flex items-center gap-2">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t(lang, "typeMessage")}
              disabled={!sessionId || sending}
              className="flex-1 rounded-full bg-white px-4 py-3 text-[14px] text-gray-900 shadow-sm ring-1 ring-black/5 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-60 dark:bg-white/[0.04] dark:text-gray-100 dark:ring-white/10 dark:placeholder:text-gray-500"
            />
            <button
              type="submit"
              disabled={!sessionId || sending || !input.trim()}
              aria-label="Send message"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-brand-600 to-brand-700 text-white shadow-sm transition hover:shadow-md active:scale-95 disabled:pointer-events-none disabled:opacity-50"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M22 2L11 13" />
                <path d="M22 2l-7 20-4-9-9-4 20-7z" />
              </svg>
            </button>
          </form>
        )}
      </main>
    </div>
  );
}

// useSearchParams() must sit inside <Suspense> or `next build` will complain.
export default function ChatPage() {
  return (
    <Suspense fallback={null}>
      <ChatInner />
    </Suspense>
  );
}