// ST-006: stored in UTC, shown in the pilot's local time.
export const TIME_ZONE = "Asia/Kolkata";
const IST_OFFSET = "+05:30"; // India has no DST.

function parts(d: Date, opts: Intl.DateTimeFormatOptions, locale = "en-GB") {
  const out: Record<string, string> = {};
  for (const p of new Intl.DateTimeFormat(locale, { timeZone: TIME_ZONE, ...opts }).formatToParts(d)) out[p.type] = p.value;
  return out;
}

/** "Monday, 23 November" */
export function eyebrowDate(d: Date): string {
  const p = parts(d, { weekday: "long", day: "numeric", month: "long" });
  return `${p.weekday}, ${p.day} ${p.month}`;
}

export function greeting(d: Date): "Good morning" | "Good afternoon" | "Good evening" {
  const hour = Number(parts(d, { hour: "numeric", hourCycle: "h23" }).hour);
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  return "Good evening";
}

/** "Sat, 28 Nov" */
export function shortDate(d: Date): string {
  const p = parts(d, { weekday: "short", day: "numeric", month: "short" });
  return `${p.weekday}, ${p.day} ${p.month}`;
}

/** "7:00 PM" */
export function clockTime(d: Date): string {
  const p = parts(d, { hour: "numeric", minute: "2-digit", hour12: true }, "en-US");
  return `${p.hour}:${p.minute} ${p.dayPeriod.toUpperCase()}`;
}

/** "Sat, 28 Nov · 7:00 PM" */
export function cardDateTime(start: Date): string {
  return `${shortDate(start)} · ${clockTime(start)}`;
}

/** "Sat, 28 Nov · 7:00–9:00 AM", "Sat, 28 Nov · 11:00 AM–1:00 PM", or the start alone. */
export function dateTimeRange(start: Date, end: Date | null): string {
  if (!end) return cardDateTime(start);
  const [s, e] = [clockTime(start), clockTime(end)];
  const samePeriod = s.slice(-2) === e.slice(-2);
  return `${shortDate(start)} · ${samePeriod ? s.slice(0, -3) : s}–${e}`;
}

/** Local calendar day, "2026-11-23". */
export function dateKey(d: Date): string {
  const p = parts(d, { year: "numeric", month: "2-digit", day: "2-digit" });
  return `${p.year}-${p.month}-${p.day}`;
}

export function addDays(key: string, n: number): string {
  const d = new Date(`${key}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Local date + "HH:MM" → UTC instant. */
export function zonedTime(key: string, hhmm: string): Date {
  return new Date(`${key}T${hhmm}:00${IST_OFFSET}`);
}

/** Date chip label: { weekday: "Thu", day: "26" }. */
export function dayChip(key: string) {
  const p = parts(zonedTime(key, "12:00"), { weekday: "short", day: "numeric" });
  return { weekday: p.weekday, day: p.day };
}

/** "Starts today" / "Starts tomorrow" / "Starts in 5 days", by local calendar day. */
export function startsIn(start: Date, now: Date): string {
  const days = Math.round((Date.parse(dateKey(start)) - Date.parse(dateKey(now))) / 86_400_000);
  if (days <= 0) return "Starts today";
  if (days === 1) return "Starts tomorrow";
  return `Starts in ${days} days`;
}

/** Inbox times: "Just now", "5m ago", "2h ago", "Yesterday", "Tue", then "28 Nov". */
export function relativeTime(at: Date, now: Date): string {
  const mins = Math.floor((now.getTime() - at.getTime()) / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  if (mins < 24 * 60) return `${Math.floor(mins / 60)}h ago`;
  const days = Math.round((Date.parse(dateKey(now)) - Date.parse(dateKey(at))) / 86_400_000);
  if (days <= 1) return "Yesterday";
  if (days < 7) return parts(at, { weekday: "short" }).weekday;
  const p = parts(at, { day: "numeric", month: "short" });
  return `${p.day} ${p.month}`;
}

/** Undo countdown, "0:09". */
export function countdown(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
