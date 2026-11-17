import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import NavTracker from "@/components/NavTracker";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "GinhawAI",
  description: "Find the welfare programs you may qualify for.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/* Applies the text size, and dark mode before the page paints, so neither flashes.
            Dark mode is a signed-in extra: only when it was chosen AND a citizen is signed in
            (or on the staff console). Everyone else always gets the light theme; the device's
            own dark setting is ignored, to keep the screens the same for first-time users. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem("theme");if(t==="dark"&&(sessionStorage.getItem("citizenToken")||location.pathname.indexOf("/admin")===0)){document.documentElement.classList.add("dark")}var s=localStorage.getItem("textSize");if(s&&/^[0-3]$/.test(s)){document.documentElement.dataset.textSize=s}}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <NavTracker />
        {children}
      </body>
    </html>
  );
}