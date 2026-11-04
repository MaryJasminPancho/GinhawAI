"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { getCitizenToken } from "@/lib/api";

// A signed-in citizen has no use for the start page: send them straight to their own home
// screen (/me), which shows their data. Signed-out visitors see the start page as before.
// Renders nothing; it only redirects.
export default function HomeGate() {
  const router = useRouter();
  useEffect(() => {
    if (getCitizenToken()) router.replace("/me");
  }, [router]);
  return null;
}
