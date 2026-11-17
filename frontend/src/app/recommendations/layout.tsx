import type { Metadata } from "next";

// Gives this page its own browser-tab title ("Your programs – GinhawAI"; see the template in app/layout.tsx).
export const metadata: Metadata = { title: "Your programs" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
