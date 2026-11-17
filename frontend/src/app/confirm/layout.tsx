import type { Metadata } from "next";

// Gives this page its own browser-tab title ("Confirm your answers – GinhawAI"; see the template in app/layout.tsx).
export const metadata: Metadata = { title: "Confirm your answers" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
