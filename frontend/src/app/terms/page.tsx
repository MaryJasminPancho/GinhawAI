import type { Metadata } from "next";
import LegalPage from "@/components/LegalPage";

export const metadata: Metadata = { title: "Terms of Use – GinhawAI" };

export default function TermsPage() {
  return <LegalPage kind="terms" />;
}
