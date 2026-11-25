import { describe, expect, it } from "vitest";
import { zonedTime } from "./time";
import {
  cancelBody,
  dateChoices,
  EMPTY_DRAFT,
  spotsLeftLabel,
  validateDraft,
  validateStepOne,
  visibilityNote,
  type Draft,
} from "./activity";

const NOW = new Date("2026-11-23T14:00:00Z"); // Mon 19:30 IST

const VALID: Draft = {
  ...EMPTY_DRAFT,
  interestId: 3,
  title: "Poker Night",
  areaSlug: "hsr-layout",
  date: "2026-11-28",
  start: "19:00",
};

describe("create draft validation (ST-111/112, server re-checks)", () => {
  it("step 1 needs exactly one interest and a title ≤ 60; details ≤ 500", () => {
    expect(validateStepOne(EMPTY_DRAFT)).toEqual({ interest: "Pick one interest.", title: "Add a title." });
    expect(validateStepOne({ interestId: 1, title: "   ", details: "" }).title).toBe("Add a title.");
    expect(validateStepOne({ interestId: 1, title: "x".repeat(61), details: "" }).title).toMatch(/60/);
    expect(validateStepOne({ interestId: 1, title: "Ok", details: "x".repeat(501) }).details).toMatch(/500/);
    expect(validateStepOne(VALID)).toEqual({});
  });

  it("step 2: area, date (no past), start in the future, optional end after start, 2–20 people", () => {
    expect(validateDraft(VALID, NOW)).toEqual({});
    expect(validateDraft({ ...VALID, areaSlug: "atlantis" }, NOW).where).toBeDefined();
    expect(validateDraft({ ...VALID, date: "2026-11-22" }, NOW).date).toBeDefined();
    expect(validateDraft({ ...VALID, date: "2026-11-23", start: "19:00" }, NOW).start).toMatch(/passed/);
    expect(validateDraft({ ...VALID, date: "2026-11-23", start: "20:00" }, NOW)).toEqual({});
    expect(validateDraft({ ...VALID, start: "" }, NOW).start).toBeDefined();
    expect(validateDraft({ ...VALID, end: "18:00" }, NOW).end).toBeDefined();
    expect(validateDraft({ ...VALID, end: "21:00" }, NOW)).toEqual({});
    expect(validateDraft({ ...VALID, limit: 1 }, NOW).limit).toBeDefined();
    expect(validateDraft({ ...VALID, limit: 21 }, NOW).limit).toBeDefined();
    expect(validateDraft({ ...VALID, visibility: "everyone" as Draft["visibility"] }, NOW).visibility).toBeDefined();
  });

  it("offers today + the next three days (Q-17)", () => {
    expect(dateChoices(NOW)).toEqual(["2026-11-23", "2026-11-24", "2026-11-25", "2026-11-26"]);
    expect(zonedTime(dateChoices(NOW)[0], "20:00") > NOW).toBe(true);
  });
});

describe("copy", () => {
  it("spots and visibility note", () => {
    expect(spotsLeftLabel(1)).toBe("1 spot left");
    expect(spotsLeftLabel(4)).toBe("4 spots left");
    expect(visibilityNote("connections_and_nearby", "Poker")).toBe(
      "Your connections and nearby poker fans will see this. Connections who like poker get a notification.",
    );
    expect(visibilityNote("connections_and_nearby", "PS5 / Gaming")).toContain("nearby PS5 / Gaming fans");
    expect(visibilityNote("connections", "Poker")).toBe("Only your connections will see this activity.");
  });

  it("S15 body names participants and the waiting count", () => {
    expect(cancelBody(["Rohan", "Divya"], 2)).toBe(
      "Rohan, Divya and the 2 people waiting on a reply will be notified. It stays in your activity history as Cancelled. This can’t be undone.",
    );
    expect(cancelBody(["Rohan"], 0)).toMatch(/^Rohan will be notified\./);
    expect(cancelBody([], 1)).toMatch(/^The 1 person waiting on a reply will be notified\./);
    expect(cancelBody([], 0)).toMatch(/^No one has joined yet\./);
  });
});
