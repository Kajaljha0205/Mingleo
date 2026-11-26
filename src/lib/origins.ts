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

const BACK_KEYS = ["q", "interest", "date", "from"] as const;

/** Search filters worth carrying through the location screen (q, interest, date, From your people). */
export function searchBackQuery(current: Record<string, string | string[] | undefined>): string {
  const out = new URLSearchParams();
  for (const k of BACK_KEYS) {
    const raw = current[k];
    const v = (Array.isArray(raw) ? raw[0] : raw) ?? "";
    if (v) out.set(k, v);
  }
  return out.toString();
}

/** Appends sanitised search filters to a search origin's href so the typed query survives S06. */
export function withBackQuery(href: string, from: unknown, back: unknown): string {
  if ((from !== "search" && from !== "search-activities") || typeof back !== "string" || !back) return href;
  const src = new URLSearchParams(back);
  const out = new URLSearchParams();
  const q = src.get("q")?.trim().slice(0, 60);
  if (q) out.set("q", q);
  const interest = src.get("interest");
  if (interest && /^[a-z0-9-]{1,30}$/.test(interest)) out.set("interest", interest);
  const date = src.get("date");
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) out.set("date", date);
  if (src.get("from") === "people") out.set("from", "people");
  const qs = out.toString();
  return qs ? `${href}?${qs}` : href;
}
