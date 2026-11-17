import type { Metadata } from "next";

// Gives this page its own browser-tab title ("Your result – GinhawAI"; see the template in app/layout.tsx).
export const metadata: Metadata = { title: "Your result" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
