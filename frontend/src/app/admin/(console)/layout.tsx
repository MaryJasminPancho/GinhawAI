import type { Metadata } from "next";
import AdminShell from "@/components/admin/AdminShell";

export const metadata: Metadata = {
  title: "GinhawAI Admin",
  description: "Administrative console for LGU welfare personnel, executives and system administrators.",
};

export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
