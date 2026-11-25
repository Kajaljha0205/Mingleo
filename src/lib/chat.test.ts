import { describe, expect, it } from "vitest";
import { mergeMessages, readOnlyCopy, togetherLine } from "./chat";

describe("chat helpers", () => {
  it("merges by id, oldest first, later copy wins", () => {
    const a = { id: "a", senderId: "x", body: "one", createdAt: "2026-11-23T01:00:00Z" };
    const b = { id: "b", senderId: "x", body: "two", createdAt: "2026-11-23T02:00:00Z" };
    expect(mergeMessages([b], [a, { ...b, body: "two!" }]).map((m) => m.body)).toEqual(["one", "two!"]);
  });

  it("explains read-only chats and times played together", () => {
    expect(readOnlyCopy(null)).toBeNull();
    expect(readOnlyCopy("cancelled")).toMatch(/cancelled/);
    expect(readOnlyCopy("closed")).toMatch(/7 days/);
    expect([1, 2, 3].map(togetherLine)).toEqual(["First activity together", "Played together twice", "Played together 3 times"]);
  });
});
