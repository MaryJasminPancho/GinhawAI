import type { Metadata } from "next";

// Gives this page its own browser-tab title ("My account – GinhawAI"; see the template in app/layout.tsx).
export const metadata: Metadata = { title: "My account" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
