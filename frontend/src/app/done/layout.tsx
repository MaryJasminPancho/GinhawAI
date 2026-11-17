import type { Metadata } from "next";

// Gives this page its own browser-tab title ("Thank you – GinhawAI"; see the template in app/layout.tsx).
export const metadata: Metadata = { title: "Thank you" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
