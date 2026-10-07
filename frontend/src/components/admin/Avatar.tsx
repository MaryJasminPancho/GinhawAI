"use client";

import { useEffect, useState } from "react";
import { fetchAvatarUrl } from "@/lib/adminApi";

const SIZES = { sm: "h-8 w-8 text-[11px]", md: "h-9 w-9 text-xs", lg: "h-24 w-24 text-2xl" } as const;

export function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

/** A staff member's profile picture, or their initials when they haven't uploaded one.
 * `path` is the avatar endpoint (null = no picture); `version` changes when the picture does. */
export default function Avatar({ path, version, name, size = "sm" }: { path: string | null; version?: string | null; name: string; size?: keyof typeof SIZES }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!path) return;
    let alive = true;
    let made: string | null = null;
    fetchAvatarUrl(path).then((u) => {
      made = u;
      if (alive) setUrl(u);
      else if (u) URL.revokeObjectURL(u);
    });
    return () => {
      alive = false;
      if (made) URL.revokeObjectURL(made);
      setUrl(null);
    };
  }, [path, version]);

  const box = `${SIZES[size]} shrink-0 rounded-full`;
  if (path && url) {
    // eslint-disable-next-line @next/next/no-img-element -- blob: URL fetched with the sign-in token
    return <img src={url} alt={`${name}'s profile picture`} className={`${box} object-cover ring-2 ring-white dark:ring-white/10`} />;
  }
  return (
    <div aria-hidden="true" className={`${box} flex items-center justify-center bg-gradient-to-br from-brand-500 to-brand-700 font-bold text-white`}>
      {initialsOf(name)}
    </div>
  );
}
