import { CalendarDays, Search, User, Users, type LucideIcon } from "lucide-react";

export type NavItem = { key: string; label: string; href: string; icon: LucideIcon; match: string[] };

// The only primary navigation (§3): same four sections, same order, at every width.
export const NAV: NavItem[] = [
  { key: "activities", label: "Activities", href: "/activities", icon: CalendarDays, match: ["/activities"] },
  { key: "discover", label: "Discover", href: "/discover", icon: Users, match: ["/discover", "/people"] },
  { key: "search", label: "Search", href: "/search/people", icon: Search, match: ["/search"] },
  { key: "profile", label: "Profile", href: "/profile", icon: User, match: ["/profile", "/settings"] },
];

export function currentSection(pathname: string): string | undefined {
  return NAV.find((n) => n.match.some((m) => pathname === m || pathname.startsWith(`${m}/`)))?.key;
}

// Full-screen flows (create steps, edit details) hide the mobile bottom bar (ST-033).
const FULL_SCREEN = [/^\/activities\/new(\/|$)/, /^\/activities\/[^/]+\/edit$/];

export function hidesBottomBar(pathname: string): boolean {
  return FULL_SCREEN.some((r) => r.test(pathname));
}
