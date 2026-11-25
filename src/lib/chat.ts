// §8 S16, §12: text only, ≤ 1,000 characters.
export const MESSAGE_MAX = 1000;
export const QUICK_REPLIES = ["On my way", "Running 10 min late", "See you there"] as const;

export type Msg = { id: string; senderId: string; body: string; createdAt: string };

/** Merge by id (server copy wins), oldest first. */
export function mergeMessages(...lists: Msg[][]): Msg[] {
  const byId = new Map<string, Msg>();
  for (const list of lists) for (const m of list) byId.set(m.id, m);
  return [...byId.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}

export function readOnlyCopy(reason: "cancelled" | "closed" | "ended" | null): string | null {
  switch (reason) {
    case "cancelled":
      return "This activity was cancelled, so the chat is read-only.";
    case "closed":
      return "This chat closed 7 days after the activity. You can still read it.";
    case "ended":
      return "You're no longer connected, so this chat has ended.";
    default:
      return null;
  }
}

/** S17 person line: "First activity together" / "Played together twice" / "Played together 3 times". */
export function togetherLine(n: number): string {
  if (n <= 1) return "First activity together";
  if (n === 2) return "Played together twice";
  return `Played together ${n} times`;
}
