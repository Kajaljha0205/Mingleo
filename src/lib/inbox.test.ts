import { describe, expect, it } from "vitest";
import { chatPreview, earlierRow, requestMeta, type ChatRow, type InboxNotification } from "./inbox";
import { connectionsSubline, myActivityRow } from "./profile";
import { relativeTime } from "./time";

const actor = { id: "p1", firstName: "Meera", photoUrl: null, connected: false, distanceKm: 1.24, sharedCount: 3 };
const activity = { id: "a1", title: "Poker Night", hostFirstName: "Rohan", cancelNote: "Rain" };
const n = (type: InboxNotification["type"]): InboxNotification => ({ id: "n", type, createdAt: "", needsReply: false, actor, activity });
const text = (t: InboxNotification["type"]) => earlierRow(n(t)).parts.map((p) => p.text).join("");

describe("inbox copy (§12)", () => {
  it("each Earlier type has its copy, icon and link", () => {
    expect(text("connection_accepted")).toBe("Meera accepted your connection request");
    expect(earlierRow(n("connection_accepted")).href).toBe("/people/p1?from=inbox");
    expect(text("connection_declined")).toBe("Meera didn\u2019t accept your request");
    expect(text("activity_created")).toBe("Meera created Poker Night");
    expect(earlierRow(n("activity_created"))).toMatchObject({ sub: "Matches your interests", icon: "calendar", href: "/activities/a1?from=inbox" });
    expect(text("join_accepted")).toBe("You\u2019re in Poker Night");
    expect(earlierRow(n("join_accepted"))).toMatchObject({ sub: "Rohan accepted", icon: "check", href: "/activities/a1/chat" });
    expect(text("join_declined")).toBe("Meera couldn\u2019t fit you into Poker Night");
    expect(text("activity_cancelled")).toBe("Poker Night was cancelled by the host");
    expect(earlierRow(n("activity_cancelled"))).toMatchObject({ sub: "Rain", icon: "cancel" });
    expect(text("participant_withdrew")).toBe("Meera withdrew from Poker Night");
    expect(earlierRow(n("participant_withdrew")).href).toBe("/activities/a1/manage");
  });

  it("request meta and chat previews", () => {
    expect(requestMeta(actor)).toBe("3 shared interests · 1.2 km");
    expect(requestMeta({ ...actor, sharedCount: 0 })).toBe("1.2 km");
    const chat: ChatRow = {
      id: "c", type: "activity", href: "", name: "Doubles", interestSlug: null, other: null, unread: 0,
      last: { body: "On my way", senderId: "u2", senderFirstName: "Meera", at: "" },
    };
    expect(chatPreview(chat, "u1")).toBe("Meera: On my way");
    expect(chatPreview(chat, "u2")).toBe("You: On my way");
    expect(chatPreview({ ...chat, type: "direct" }, "u1")).toBe("On my way");
    expect(chatPreview({ ...chat, last: null }, "u1")).toBe("No messages yet");
  });

  it("relative times", () => {
    const now = new Date("2026-11-26T12:00:00+05:30"); // Thu
    const ago = (ms: number) => relativeTime(new Date(now.getTime() - ms), now);
    expect(ago(20_000)).toBe("Just now");
    expect(ago(5 * 60_000)).toBe("5m ago");
    expect(ago(2 * 3600_000)).toBe("2h ago");
    expect(ago(30 * 3600_000)).toBe("Yesterday");
    expect(ago(3 * 86_400_000)).toBe("Mon");
    expect(ago(10 * 86_400_000)).toBe("16 Nov");
  });
});

describe("my activities rows (ST-173)", () => {
  const base = { id: "a1", going: 2, limit: 5, hostFirstName: "Meera", phase: "open" as const };
  it("who line, pill and link per tab", () => {
    expect(myActivityRow({ ...base, tab: "created", myStatus: "host" })).toEqual({
      href: "/activities/a1/manage", who: "2 of 5 going", pill: { label: "Hosting", variant: "host" },
    });
    expect(myActivityRow({ ...base, tab: "joined", myStatus: "accepted" })).toMatchObject({
      href: "/activities/a1/chat", who: "Hosted by Meera", pill: { label: "Going" },
    });
    expect(myActivityRow({ ...base, tab: "joined", myStatus: "requested" })).toMatchObject({
      href: "/activities/a1?from=profile", pill: { label: "Requested", variant: "pending" },
    });
    expect(myActivityRow({ ...base, tab: "past", myStatus: "accepted", phase: "completed" })).toMatchObject({
      href: "/activities/a1/after", who: "With 1 person", pill: { label: "Completed" },
    });
    expect(myActivityRow({ ...base, tab: "past", myStatus: "closed", phase: "cancelled" })).toMatchObject({
      href: "/activities/a1?from=profile", who: "Cancelled by host", pill: { label: "Cancelled", variant: "cancelled" },
    });
    expect(myActivityRow({ ...base, tab: "past", myStatus: "host", phase: "cancelled" }).href).toBe("/activities/a1/manage");
  });

  it("connections sub-line", () => {
    expect(connectionsSubline(1, 18)).toBe("1 pending request waiting for you");
    expect(connectionsSubline(2, 18)).toBe("2 pending requests waiting for you");
    expect(connectionsSubline(0, 18)).toBe("18 connections");
    expect(connectionsSubline(0, 0)).toBe("No connections yet");
  });
});
