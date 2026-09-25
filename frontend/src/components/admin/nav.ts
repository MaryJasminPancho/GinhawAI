import type { RoleGroup } from "@/lib/adminApi";

// Navigation for the admin console. Each item maps to a use case in the
// manuscript's diagrams, and `roles` controls who sees it:
//   welfare   = Authorized Welfare Personnel (LGU Administrator, Social Worker)  — Fig. 9
//   executive = LGU Executive / Partner Organization                            — Fig. 10
//   sysadmin  = System Administrator                                            — Fig. 11
// The System Administrator can open every screen.

export type NavItem = { href: string; label: string; icon: string; roles: RoleGroup[] };
export type NavSection = { title: string; items: NavItem[] };

// 24x24 stroke icon paths
const I = {
  home: "M3 10.5L12 3l9 7.5V20a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1v-9.5z",
  rules: "M9 5h11M9 12h11M9 19h11M4 5h.01M4 12h.01M4 19h.01",
  calendar: "M4 6a2 2 0 012-2h12a2 2 0 012 2v13a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM4 10h16M8 2v4M16 2v4",
  office: "M4 21V5a2 2 0 012-2h8a2 2 0 012 2v16M16 9h2a2 2 0 012 2v10M8 7h4M8 11h4M8 15h4M2 21h20",
  check: "M9 11l3 3 8-8M20 12v7a2 2 0 01-2 2H6a2 2 0 01-2-2V5a2 2 0 012-2h9",
  audit: "M12 8v4l3 2M3 12a9 9 0 1018 0 9 9 0 00-18 0z",
  map: "M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14",
  report: "M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9l-6-6zM14 3v6h6M8 17v-3M12 17v-6M16 17v-2",
  pulse: "M3 12h4l3-8 4 16 3-8h4",
  users: "M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM22 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75",
  sms: "M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10zM8 9h8M8 13h5",
  shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zM9 12l2 2 4-4",
};

export const NAV: NavSection[] = [
  {
    title: "Overview",
    items: [{ href: "/admin", label: "Dashboard", icon: I.home, roles: ["welfare", "executive", "sysadmin"] }],
  },
  {
    title: "Welfare Operations",
    items: [
      { href: "/admin/programs", label: "Program Rules Matrix", icon: I.rules, roles: ["welfare", "sysadmin"] },
      { href: "/admin/schedules", label: "Barangay Aid Schedules", icon: I.calendar, roles: ["welfare", "sysadmin"] },
      { href: "/admin/offices", label: "Office Directory", icon: I.office, roles: ["welfare", "sysadmin"] },
      { href: "/admin/validation", label: "Blind Validation", icon: I.check, roles: ["welfare", "sysadmin"] },
      { href: "/admin/audit-logs", label: "Audit Logs", icon: I.audit, roles: ["welfare", "sysadmin"] },
    ],
  },
  {
    title: "Policy Intelligence",
    items: [
      { href: "/admin/analytics", label: "Vulnerability Heatmap", icon: I.map, roles: ["executive", "sysadmin"] },
      { href: "/admin/reports", label: "Reports & Exports", icon: I.report, roles: ["executive", "sysadmin"] },
    ],
  },
  {
    title: "System",
    items: [
      { href: "/admin/system", label: "System Health", icon: I.pulse, roles: ["sysadmin"] },
      { href: "/admin/users", label: "Staff Credentials", icon: I.users, roles: ["sysadmin"] },
      { href: "/admin/sms-gateway", label: "SMS Gateway", icon: I.sms, roles: ["sysadmin"] },
      { href: "/admin/security", label: "Security Policy", icon: I.shield, roles: ["sysadmin"] },
    ],
  },
];

export function navFor(group: RoleGroup): NavSection[] {
  return NAV.map((s) => ({ ...s, items: s.items.filter((i) => i.roles.includes(group)) })).filter((s) => s.items.length > 0);
}

export function canAccess(group: RoleGroup, pathname: string): boolean {
  const all = NAV.flatMap((s) => s.items);
  // Longest matching href wins, so "/admin/programs" isn't treated as "/admin".
  const match = all.filter((i) => pathname === i.href || pathname.startsWith(i.href + "/")).sort((a, b) => b.href.length - a.href.length)[0];
  return !match || match.roles.includes(group);
}

// What each role's console is called in the manuscript (system boundary names).
export const CONSOLE_NAME: Record<RoleGroup, string> = {
  welfare: "Administrative Console",
  executive: "Executive Dashboard",
  sysadmin: "Backend Core Environment",
};
