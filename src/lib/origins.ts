// Where "Back to …" links and edit-mode saves return to. Add origins as their screens are built.
export const ORIGINS = {
  discover: { href: "/discover", label: "Discover" },
  activities: { href: "/activities", label: "Activities" },
  search: { href: "/search/people", label: "Search" },
  "search-activities": { href: "/search/activities", label: "Search" },
  inbox: { href: "/inbox", label: "Inbox" },
  profile: { href: "/profile", label: "Profile" },
  connections: { href: "/profile/connections", label: "My connections" },
  settings: { href: "/settings", label: "Settings" },
} as const;

export type Origin = keyof typeof ORIGINS;

export function originFrom(value: unknown, fallback: Origin = "discover") {
  return ORIGINS[(typeof value === "string" && value in ORIGINS ? value : fallback) as Origin];
}

export function isOrigin(value: unknown): value is Origin {
  return typeof value === "string" && value in ORIGINS;
}
