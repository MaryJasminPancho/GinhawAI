export type Role = "user" | "assistant";

type Props = {
  role: Role;
  text: string;
};

function AssistantAvatar() {
  return (
    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-sm">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2z" />
      </svg>
    </div>
  );
}

export default function ChatBubble({ role, text }: Props) {
  if (role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[78%] rounded-2xl rounded-br-sm bg-gradient-to-b from-brand-600 to-brand-700 px-4 py-2.5 text-[14px] leading-relaxed text-white shadow-sm">
          {text}
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-end gap-2">
      <AssistantAvatar />
      <div className="max-w-[78%] whitespace-pre-wrap rounded-2xl rounded-bl-sm bg-gray-100 px-4 py-2.5 text-[14px] leading-relaxed text-gray-800 dark:bg-white/[0.06] dark:text-gray-100">
        {text}
      </div>
    </div>
  );
}

/** Three bouncing dots in an assistant-style bubble, shown while waiting for a reply. */
export function TypingBubble() {
  return (
    <div className="flex items-end gap-2">
      <AssistantAvatar />
      <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm bg-gray-100 px-4 py-3 dark:bg-white/[0.06]">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:-0.3s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:-0.15s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400" />
      </div>
    </div>
  );
}