import { inSentence } from "@/lib/activity";
import { plural } from "@/lib/format";
import { addDays, dateKey, shortDate, zonedTime } from "@/lib/time";

/** S19: "Any day" + the next three days, starting today (Q-51). */
export const DAY_CHIP_COUNT = 3;
export const SEARCH_DEBOUNCE_MS = 300;
export const QUERY_MAX = 60;

type Params = Record<string, string | string[] | undefined>;
type Named = { slug: string; name: string };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export function cleanQuery(v: string | string[] | undefined): string {
  return one(v).trim().slice(0, QUERY_MAX);
}

export function pickInterest<T extends Named>(v: string | string[] | undefined, catalogue: T[]): T | null {
  const slug = one(v);
  return catalogue.find((i) => i.slug === slug) ?? null;
}

/** A valid local day from today on, else null (= Any day). */
export function pickDate(v: string | string[] | undefined, now: Date): string | null {
  const d = one(v);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || Number.isNaN(Date.parse(d))) return null;
  return d >= dateKey(now) ? d : null;
}

export function dayChips(now: Date): string[] {
  const today = dateKey(now);
  return Array.from({ length: DAY_CHIP_COUNT }, (_, i) => addDays(today, i));
}

/** "Sat 28 Nov" */
export function dayLabel(key: string): string {
  return shortDate(zonedTime(key, "12:00")).replace(",", "");
}

/** Builds a search URL from the current filters plus changes; empty values are dropped. */
export function searchHref(path: string, current: Params, patch: Record<string, string | null> = {}): string {
  const out = new URLSearchParams();
  for (const [k, v] of Object.entries(current)) if (one(v)) out.set(k, one(v));
  for (const [k, v] of Object.entries(patch)) {
    if (v) out.set(k, v);
    else out.delete(k);
  }
  const qs = out.toString();
  return qs ? `${path}?${qs}` : path;
}

/** "4 people into poker within 5 km, nearest first" */
export function peopleCountLine(n: number, interest: string | null, radiusKm: number): string {
  const into = interest ? ` into ${inSentence(interest)}` : "";
  return `${plural(n, "person", "people")}${into} within ${radiusKm} km, nearest first`;
}

/** "3 activities on Sat 28 Nov within 5 km" */
export function activitiesCountLine(n: number, date: string | null, radiusKm: number): string {
  return `${plural(n, "activity", "activities")} on ${date ? dayLabel(date) : "any day"} within ${radiusKm} km`;
}

/** Card label next to the name: "Connected", "3 mutual" or "No mutuals yet". */
export function mutualLabel(connected: boolean, mutual: number): string {
  if (connected) return "Connected";
  return mutual > 0 ? `${mutual} mutual` : "No mutuals yet";
}
