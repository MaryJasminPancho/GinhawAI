"use client";

import Image from "next/image";
import Link from "next/link";
import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import ChatBubble, { Role } from "@/components/ChatBubble";
import { sendMessage, startSession } from "@/lib/api";

type Msg = { id: number; role: Role; text: string };

function ChatInner() {
  // Language page should link here as /chat?lang=fil | /chat?lang=bis | /chat?lang=en
  const lang = useSearchParams().get("lang") ?? "en";

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nextId = useRef(0);
  const started = useRef(false); // stops React dev Strict Mode from creating 2 sessions
  const bottomRef = useRef<HTMLDivElement>(null);

  const addMessage = (role: Role, text: string) =>
    setMessages((prev) => [...prev, { id: nextId.current++, role, text }]);

  // Start a session once when the page opens.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    startSession(lang)
      .then((s) => setSessionId(s.session_id))
      .catch((e) => setError(`Could not start a chat session. Is the backend running? (${e.message})`));
  }, [lang]);

  // Keep the newest message in view.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || !sessionId || sending || complete) return;

    setInput("");
    setError(null);
    addMessage("user", text);
    setSending(true);
    try {
      const res = await sendMessage(sessionId, text);
      addMessage("assistant", res.reply);
      if (res.is_complete) setComplete(true);
    } catch (e) {
      setError(`Message failed to send. ${(e as Error).message}`);
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="mx-auto flex h-screen max-w-2xl flex-col p-4 text-gray-900 dark:text-gray-100">
      <header className="mb-4 flex items-center gap-3">
        {/* White tile keeps the logo's white background looking intentional in dark mode */}
        <div className="rounded-lg bg-white p-1 shadow-sm">
          <Image
            src="/logo.png"
            alt="GinhawAI"
            width={243}
            height={313}
            priority
            className="h-14 w-auto"
          />
        </div>
        <h1 className="text-xl font-semibold text-green-800 dark:text-green-400">
          Assessment
        </h1>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto rounded-lg border border-gray-300 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
        {messages.length === 0 && !error && (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {sessionId ? "Say hello to begin." : "Starting session…"}
          </p>
        )}
        {messages.map((m) => (
          <ChatBubble key={m.id} role={m.role} text={m.text} />
        ))}
        {sending && (
          <p className="text-sm text-gray-500 dark:text-gray-400">Typing…</p>
        )}
        <div ref={bottomRef} />
      </div>

      {error && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      {complete ? (
        <Link
          href={`/confirm?session=${sessionId}`}
          className="mt-3 rounded-lg bg-green-700 px-4 py-2 text-center font-medium text-white hover:bg-green-800 dark:bg-green-600 dark:hover:bg-green-500"
        >
          Review your answers
        </Link>
      ) : (
        <form onSubmit={handleSend} className="mt-3 flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message…"
            disabled={!sessionId || sending}
            className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-600 disabled:opacity-60 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500"
          />
          <button
            type="submit"
            disabled={!sessionId || sending || !input.trim()}
            className="rounded-lg bg-green-700 px-4 py-2 font-medium text-white hover:bg-green-800 disabled:opacity-50 dark:bg-green-600 dark:hover:bg-green-500"
          >
            Send
          </button>
        </form>
      )}
    </main>
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