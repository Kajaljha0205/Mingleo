import { findArea } from "@/lib/locations/bengaluru";
import { addDays, dateKey, zonedTime } from "@/lib/time";

// Limits (§8 S12–S15, §10). Server re-checks every one in create_activity() / table constraints.
export const TITLE_MAX = 60;
export const DETAILS_MAX = 500;
export const ADDRESS_MAX = 120;
export const CANCEL_NOTE_MAX = 200;
export const LIMIT_MIN = 2;
export const LIMIT_MAX = 20;
export const LIMIT_DEFAULT = 5;
export const DECLINE_UNDO_MS = 10_000;
/** Q-17: date chips are today + the next three days. */
export const DATE_CHIP_COUNT = 4;

export type Visibility = "connections" | "connections_and_nearby";

export type Draft = {
  interestId: number | null;
  title: string;
  details: string;
  areaSlug: string | null;
  address: string;
  date: string | null;
  start: string;
  end: string;
  limit: number;
  visibility: Visibility;
};

export const EMPTY_DRAFT: Draft = {
  interestId: null,
  title: "",
  details: "",
  areaSlug: null,
  address: "",
  date: null,
  start: "",
  end: "",
  limit: LIMIT_DEFAULT,
  visibility: "connections_and_nearby",
};

export type DraftErrors = Partial<Record<"interest" | "title" | "details" | "where" | "address" | "date" | "start" | "end" | "limit" | "visibility", string>>;

export function validateStepOne(d: Pick<Draft, "interestId" | "title" | "details">): DraftErrors {
  const e: DraftErrors = {};
  if (!d.interestId) e.interest = "Pick one interest.";
  const title = d.title.trim();
  if (!title) e.title = "Add a title.";
  else if (title.length > TITLE_MAX) e.title = `Use ${TITLE_MAX} characters or fewer.`;
  if (d.details.length > DETAILS_MAX) e.details = `Use ${DETAILS_MAX} characters or fewer.`;
  return e;
}

export function validateDraft(d: Draft, now: Date): DraftErrors {
  const e = validateStepOne(d);
  if (!d.areaSlug || !findArea(d.areaSlug)) e.where = "Choose where it happens.";
  if (d.address.length > ADDRESS_MAX) e.address = `Use ${ADDRESS_MAX} characters or fewer.`;
  if (!d.date || !/^\d{4}-\d{2}-\d{2}$/.test(d.date)) e.date = "Choose a date.";
  else if (d.date < dateKey(now)) e.date = "Choose today or a later date.";
  if (!/^\d{2}:\d{2}$/.test(d.start)) e.start = "Add a start time.";
  else if (d.date && !e.date && zonedTime(d.date, d.start) <= now) e.start = "Start time has passed. Pick a later time.";
  if (d.end && (!/^\d{2}:\d{2}$/.test(d.end) || d.end <= d.start)) e.end = "End time must be after the start.";
  if (!Number.isInteger(d.limit) || d.limit < LIMIT_MIN || d.limit > LIMIT_MAX) e.limit = `Choose ${LIMIT_MIN} to ${LIMIT_MAX} people.`;
  if (d.visibility !== "connections" && d.visibility !== "connections_and_nearby") e.visibility = "Choose who can join.";
  return e;
}

export function dateChoices(now: Date): string[] {
  const today = dateKey(now);
  return Array.from({ length: DATE_CHIP_COUNT }, (_, i) => addDays(today, i));
}

/** Card → S11, or S14 when the viewer is the host. */
export function activityHref(a: { id: string; host: { id: string } }, userId: string): string {
  return a.host.id === userId ? `/activities/${a.id}/manage` : `/activities/${a.id}`;
}

/** Inline card action (S10, S19): Request to join while open and not full, or the viewer's request/accepted state. */
export function showsJoinAction(a: { viewerState: string; going: number; limit: number }): boolean {
  const canRequest = (a.viewerState === "none" || a.viewerState === "withdrawn") && a.going < a.limit;
  return canRequest || a.viewerState === "requested" || a.viewerState === "accepted";
}

export function spotsLeftLabel(left: number): string {
  return `${left} ${left === 1 ? "spot" : "spots"} left`;
}

/** S11 line under the title. */
export function visibilityLine(v: Visibility): string {
  return v === "connections" ? "Connections only" : "Open to everyone nearby · host approves each request";
}

export function visibilityPill(v: Visibility): string {
  return v === "connections" ? "Connections only" : "Connections + nearby";
}

/** "Poker" → "poker"; keeps names that start with an acronym ("PS5 / Gaming"). */
export function inSentence(name: string): string {
  return /^[A-Z0-9]{2}/.test(name) ? name : name.toLowerCase();
}

/** S13 preview note. */
export function visibilityNote(v: Visibility, interestName: string | null): string {
  if (v === "connections") return "Only your connections will see this activity.";
  const i = interestName ? inSentence(interestName) : "interest";
  return `Your connections and nearby ${i} fans will see this. Connections who like ${i} get a notification.`;
}

/** S15 body. */
export function cancelBody(participants: string[], waiting: number): string {
  const items = [...participants];
  if (waiting) items.push(waiting === 1 ? "the 1 person waiting on a reply" : `the ${waiting} people waiting on a reply`);
  const who = items.length <= 1 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
  const lead = who ? `${who[0].toUpperCase()}${who.slice(1)} will be notified. ` : "No one has joined yet. ";
  return `${lead}It stays in your activity history as Cancelled. This can’t be undone.`;
}
