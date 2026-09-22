export type Role = "user" | "assistant";

type Props = {
  role: Role;
  text: string;
};

export default function ChatBubble({ role, text }: Props) {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm ${
          isUser
            ? "rounded-br-sm bg-green-700 text-white dark:bg-green-600"
            : "rounded-bl-sm bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100"
        }`}
      >
        {text}
      </div>
    </div>
  );
}