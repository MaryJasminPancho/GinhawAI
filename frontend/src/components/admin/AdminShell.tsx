"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, ReactNode, useContext, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import ThemeToggle from "@/components/ThemeToggle";
import { AdminSession, getAdminSession, getProfile, logout, OWN_AVATAR_PATH, Profile, roleGroup, RoleGroup } from "@/lib/adminApi";
import Avatar from "./Avatar";
import { ACCOUNT_PATH, canAccess, CONSOLE_NAME, navFor } from "./nav";

type Ctx = {
  session: AdminSession;
  group: RoleGroup;
  /** Signed-in person's profile (name, picture); null until loaded or while on a temporary password. */
  profile: Profile | null;
  setProfile: (p: Profile) => void;
  /** Why the profile could not be loaded (null when fine or still loading). */
  profileError: string | null;
  reloadProfile: () => void;
};
const AdminContext = createContext<Ctx | null>(null);

export function useAdmin(): Ctx {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error("useAdmin must be used inside <AdminShell>");
  return ctx;
}

// Read the stored session without a setState-in-effect round trip.
// sessionStorage has no change event within the same tab, so we poll lightly
// (catches expiry and sign-out in another component).
function subscribe(cb: () => void) {
  const t = setInterval(cb, 5000);
  window.addEventListener("storage", cb);
  return () => {
    clearInterval(t);
    window.removeEventListener("storage", cb);
  };
}
const getSnapshot = () => {
  const s = getAdminSession();
  return s ? JSON.stringify(s) : "";
};
const getServerSnapshot = () => null;

function NavIcon({ d }: { d: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
      <path d={d} />
    </svg>
  );
}

export default function AdminShell({ children }: { children: ReactNode }) {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const session = useMemo<AdminSession | null>(() => (raw ? JSON.parse(raw) : null), [raw]);
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  // Not signed in (raw === "" on the client) -> go to the login screen.
  useEffect(() => {
    if (raw === "") router.replace(`/admin/login?next=${encodeURIComponent(pathname)}`);
  }, [raw, router, pathname]);

  // On a temporary password, My Account (where the new password is set) is the only page.
  const mustChange = !!session?.must_change_password;
  useEffect(() => {
    if (mustChange && pathname !== ACCOUNT_PATH) router.replace(ACCOUNT_PATH);
  }, [mustChange, pathname, router]);

  // Name and picture for the sidebar card (the API refuses this until a temporary password is replaced).
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileTry, setProfileTry] = useState(0);
  const userId = session?.user_id;
  useEffect(() => {
    if (!userId || mustChange) return;
    getProfile()
      .then((p) => {
        setProfile(p);
        setProfileError(null);
      })
      .catch((e) => setProfileError(e instanceof Error ? e.message : "Could not load your profile"));
  }, [userId, mustChange, profileTry]);
  const reloadProfile = () => {
    setProfileError(null);
    setProfileTry((n) => n + 1);
  };

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white dark:bg-[#0a0f0c]">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  const group = roleGroup(session.role);
  const sections = navFor(group, mustChange);
  // My Account is reachable by everyone (System Administrators open it from their name card).
  const allowed = mustChange ? pathname === ACCOUNT_PATH : pathname === ACCOUNT_PATH || canAccess(group, pathname);
  const displayName = profile?.full_name || session.username;

  async function handleLogout() {
    await logout();
    router.replace("/admin/login");
  }

  const sidebar = (
    <nav aria-label="Admin" className="flex h-full flex-col">
      <Link href="/admin" className="flex items-center gap-2.5 px-2 py-1" onClick={() => setMenuOpen(false)}>
        <div className="shrink-0 rounded-xl bg-white p-1.5 shadow-sm ring-1 ring-black/5">
          <Image src="/logo.png" alt="" width={243} height={313} priority className="h-7 w-auto" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-brand-800 dark:text-brand-300">GinhawAI</p>
          <p className="truncate text-[11px] text-gray-500 dark:text-gray-400">{CONSOLE_NAME[group]}</p>
        </div>
      </Link>

      <div className="mt-6 flex-1 space-y-5 overflow-y-auto">
        {sections.map((s) => (
          <div key={s.title}>
            <p className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">{s.title}</p>
            <ul className="space-y-0.5">
              {s.items.map((item) => {
                const active = item.href === "/admin" ? pathname === "/admin" : pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setMenuOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                        active
                          ? "bg-gradient-to-b from-brand-600 to-brand-700 text-white shadow-sm"
                          : "text-gray-600 hover:bg-brand-50 hover:text-brand-800 dark:text-gray-300 dark:hover:bg-white/5 dark:hover:text-white"
                      }`}
                    >
                      <NavIcon d={item.icon} />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-2xl bg-brand-50/80 p-3 ring-1 ring-brand-100 dark:bg-white/[0.04] dark:ring-white/10">
        <Link
          href={ACCOUNT_PATH}
          onClick={() => setMenuOpen(false)}
          title="Your profile"
          className="-m-1 flex items-center gap-2.5 rounded-xl p-1 transition hover:bg-white/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:hover:bg-white/5"
        >
          <Avatar path={profile?.has_avatar ? OWN_AVATAR_PATH : null} version={profile?.avatar_updated_at} name={displayName} size="md" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-gray-900 dark:text-white">{displayName}</p>
            <p className="truncate text-[11px] text-gray-500 dark:text-gray-400">{session.role}</p>
          </div>
        </Link>
        <button
          type="button"
          onClick={handleLogout}
          className="mt-3 w-full rounded-xl bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 ring-1 ring-gray-200 transition hover:bg-gray-50 dark:bg-gray-900 dark:text-gray-300 dark:ring-white/10 dark:hover:bg-gray-800"
        >
          Sign out
        </button>
      </div>
    </nav>
  );

  return (
    <AdminContext.Provider value={{ session, group, profile, setProfile, profileError, reloadProfile }}>
      <div className="relative isolate min-h-screen bg-gray-50/60 text-gray-900 dark:bg-[#0a0f0c] dark:text-gray-100">
        {/* soft brand wash like the citizen screens, kept subtle for dense data */}
        <div className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-72 bg-gradient-to-b from-brand-50 to-transparent dark:from-brand-950/30" />

        {/* Desktop sidebar */}
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 print:!hidden border-r border-gray-200/70 bg-white/80 p-4 backdrop-blur-xl lg:block dark:border-white/10 dark:bg-[#0c130f]/80">{sidebar}</aside>

        {/* Mobile drawer */}
        {menuOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <button type="button" aria-label="Close menu" className="absolute inset-0 bg-brand-950/40 backdrop-blur-sm" onClick={() => setMenuOpen(false)} />
            <aside className="absolute inset-y-0 left-0 w-72 max-w-[85%] bg-white p-4 shadow-2xl dark:bg-[#0c130f]">{sidebar}</aside>
          </div>
        )}

        <div className="lg:pl-64 print:!pl-0">
          <header className="sticky top-0 z-20 flex print:hidden items-center justify-between gap-3 border-b border-gray-200/70 bg-white/80 px-4 py-3 backdrop-blur-xl sm:px-6 dark:border-white/10 dark:bg-[#0a0f0c]/80">
            <div className="flex min-w-0 items-center gap-2">
              <button
                type="button"
                onClick={() => setMenuOpen(true)}
                aria-label="Open menu"
                className="rounded-xl p-2 text-gray-600 hover:bg-gray-100 lg:hidden dark:text-gray-300 dark:hover:bg-white/10"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <div className="flex min-w-0 items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                <span className="hidden sm:inline">Cebu City</span>
                <span className="hidden text-gray-300 sm:inline dark:text-gray-600">/</span>
                <span className="truncate font-semibold text-brand-800 dark:text-brand-300">{CONSOLE_NAME[group]}</span>
              </div>
            </div>
            <ThemeToggle />
          </header>

          <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
            {allowed ? (
              children
            ) : (
              <div className="mx-auto max-w-md rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-black/5 dark:bg-white/[0.04] dark:ring-white/10">
                <p className="text-lg font-bold">You don&apos;t have access to this page</p>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  Your role ({session.role}) can&apos;t open this section. Ask a System Administrator if you need access.
                </p>
                <Link href="/admin" className="mt-5 inline-block text-sm font-semibold text-brand-700 hover:underline dark:text-brand-300">
                  Back to dashboard
                </Link>
              </div>
            )}
          </main>
        </div>
      </div>
    </AdminContext.Provider>
  );
}
