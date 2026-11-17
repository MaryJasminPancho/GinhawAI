// Shows text with any web address in it (e.g. "psaserbilis.com.ph") in blue and tappable,
// so it stands out. Used for the "how to get it" text and paper notes.

const URL_RE = /\b((?:https?:\/\/)?(?:[a-z0-9-]+\.)+(?:com\.ph|gov\.ph|org\.ph|com|org|net|ph)(?:\/[^\s)]*)?)/gi;

export default function LinkText({ text, className = "text-blue-600 underline underline-offset-2 dark:text-blue-400" }: { text: string; className?: string }) {
  const parts: React.ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(URL_RE)) {
    const at = m.index ?? 0;
    const url = m[1].replace(/[.,]+$/, ""); // a sentence's own period isn't part of the address
    if (at > last) parts.push(text.slice(last, at));
    parts.push(
      <a key={at} href={url.startsWith("http") ? url : `https://${url}`} target="_blank" rel="noopener noreferrer" className={`font-medium ${className}`}>
        {url}
      </a>,
    );
    last = at + url.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}
