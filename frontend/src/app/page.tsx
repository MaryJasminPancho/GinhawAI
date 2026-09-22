import Image from "next/image";
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";

export default function SplashScreen() {
  return (
    <main className="relative mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-8 p-6 text-center text-gray-900 dark:text-gray-100">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      {/* White tile keeps the logo's white background looking intentional in dark mode */}
      <div className="rounded-2xl bg-white p-3 shadow-sm">
        <Image
          src="/logo.png"
          alt="GinhawAI"
          width={243}
          height={313}
          priority
          className="h-48 w-auto"
        />
      </div>

      <p className="text-lg text-gray-600 dark:text-gray-300">
        Find the welfare programs you may qualify for.
      </p>

      <Link
        href="/language"
        className="w-full rounded-xl bg-green-700 px-6 py-3 text-lg font-semibold text-white transition hover:bg-green-800 focus:outline-none focus:ring-2 focus:ring-green-600 focus:ring-offset-2 dark:bg-green-600 dark:hover:bg-green-500 dark:focus:ring-offset-gray-950"
      >
        Get started
      </Link>
    </main>
  );
}