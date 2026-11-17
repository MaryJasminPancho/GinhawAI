import type { Metadata } from "next";

// Gives this page its own browser-tab title ("Log in or sign up – GinhawAI"; see the template in app/layout.tsx).
export const metadata: Metadata = { title: "Log in or sign up" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
