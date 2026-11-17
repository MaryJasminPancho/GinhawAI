import type { Metadata } from "next";

// Gives this page its own browser-tab title ("Chat – GinhawAI"; see the template in app/layout.tsx).
export const metadata: Metadata = { title: "Chat" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
