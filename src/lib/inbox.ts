import { distanceLabel, plural } from "@/lib/format";

export type NotificationType =
  | "connection_request"
  | "connection_accepted"
  | "connection_declined"
  | "activity_created"
  | "join_requested"
  | "join_accepted"
  | "join_declined"
  | "activity_cancelled"
  | "participant_withdrew";

export type InboxActor = {
  id: string;
  firstName: string;
  photoUrl: string | null;
  connected: boolean;
  distanceKm: number;
  sharedCount: number;
};

export type InboxNotification = {
  id: string;
  type: NotificationType;
  createdAt: string;
  needsReply: boolean;
  actor: InboxActor | null;
  activity: { id: string; title: string; hostFirstName: string; cancelNote: string | null } | null;
};

export type Part = { text: string; bold?: boolean };
export type RowIcon = "avatar" | "check" | "calendar" | "cancel";

/** §12 "Earlier" copy, icon and link for one notification. */
export function earlierRow(n: InboxNotification): { parts: Part[]; sub: string | null; href: string; icon: RowIcon } {
  const name = n.actor?.firstName ?? "Someone";
  const title = n.activity?.title ?? "an activity";
  const person = n.actor ? `/people/${n.actor.id}?from=inbox` : "/inbox";
  const activity = n.activity ? `/activities/${n.activity.id}?from=inbox` : "/inbox";
  switch (n.type) {
    case "connection_accepted":
      return { parts: [{ text: name, bold: true }, { text: " accepted your connection request" }], sub: null, href: person, icon: "avatar" };
    case "connection_declined":
      return { parts: [{ text: name, bold: true }, { text: " didn\u2019t accept your request" }], sub: null, href: person, icon: "avatar" };
    case "activity_created":
      return { parts: [{ text: name, bold: true }, { text: ` created ${title}` }], sub: "Matches your interests", href: activity, icon: "calendar" };
    case "join_accepted":
      return {
        parts: [{ text: "You\u2019re in " }, { text: title, bold: true }],
        sub: `${n.activity?.hostFirstName ?? name} accepted`,
        href: n.activity ? `/activities/${n.activity.id}/chat` : "/inbox",
        icon: "check",
      };
    case "join_declined":
      return { parts: [{ text: name, bold: true }, { text: " couldn\u2019t fit you into " }, { text: title, bold: true }], sub: null, href: activity, icon: "avatar" };
    case "activity_cancelled":
      return { parts: [{ text: title, bold: true }, { text: " was cancelled by the host" }], sub: n.activity?.cancelNote ?? null, href: activity, icon: "cancel" };
    case "participant_withdrew":
      return {
        parts: [{ text: name, bold: true }, { text: " withdrew from " }, { text: title, bold: true }],
        sub: null,
        href: n.activity ? `/activities/${n.activity.id}/manage` : "/inbox",
        icon: "avatar",
      };
    default:
      return { parts: [{ text: name, bold: true }], sub: null, href: person, icon: "avatar" };
  }
}

/** "3 shared interests · 1.2 km" */
export function requestMeta(a: InboxActor): string {
  return [a.sharedCount > 0 ? plural(a.sharedCount, "shared interest", "shared interests") : null, distanceLabel(a.distanceKm)]
    .filter(Boolean)
    .join(" · ");
}

export type ChatRow = {
  id: string;
  type: "activity" | "direct";
  href: string;
  name: string;
  interestSlug: string | null;
  other: { id: string; firstName: string; photoUrl: string | null } | null;
  last: { body: string; senderId: string; senderFirstName: string; at: string } | null;
  unread: number;
};

/** "You: …" for own messages; "{name}: …" in group chats. */
export function chatPreview(c: ChatRow, userId: string): string {
  if (!c.last) return "No messages yet";
  if (c.last.senderId === userId) return `You: ${c.last.body}`;
  return c.type === "activity" ? `${c.last.senderFirstName}: ${c.last.body}` : c.last.body;
}
