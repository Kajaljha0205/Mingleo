import { describe, expect, it } from "vitest";
import {
  activitiesCountLine,
  cleanQuery,
  dayChips,
  dayLabel,
  mutualLabel,
  peopleCountLine,
  pickDate,
  pickInterest,
  searchHref,
} from "./search";

// Thu 26 Nov 2026, 10:00 IST
const NOW = new Date("2026-11-26T04:30:00Z");

describe("search filters", () => {
  it("query is trimmed and capped", () => {
    expect(cleanQuery("  poker ")).toBe("poker");
    expect(cleanQuery(["a", "b"])).toBe("a");
    expect(cleanQuery(undefined)).toBe("");
    expect(cleanQuery("x".repeat(80))).toHaveLength(60);
  });

  it("interest by slug from the given list only", () => {
    const cat = [{ id: 3, slug: "poker", name: "Poker" }];
    expect(pickInterest("poker", cat)?.id).toBe(3);
    expect(pickInterest("travel", cat)).toBeNull();
  });

  it("date must be a real local day from today on", () => {
    expect(pickDate("2026-11-28", NOW)).toBe("2026-11-28");
    expect(pickDate("2026-11-26", NOW)).toBe("2026-11-26");
    expect(pickDate("2026-11-25", NOW)).toBeNull();
    expect(pickDate("28/11/2026", NOW)).toBeNull();
    expect(pickDate("2026-13-40", NOW)).toBeNull();
  });

  it("day chips: today + the next two days, in IST", () => {
    expect(dayChips(NOW)).toEqual(["2026-11-26", "2026-11-27", "2026-11-28"]);
    // 23:00 IST on the 26th is still the 26th.
    expect(dayChips(new Date("2026-11-26T17:30:00Z"))[0]).toBe("2026-11-26");
    expect(dayLabel("2026-11-28")).toBe("Sat 28 Nov");
  });

  it("hrefs keep other filters, replace or drop one", () => {
    const current = { q: "poker", interest: "poker", radius: "5" };
    expect(searchHref("/search/people", current, { radius: "10" })).toBe("/search/people?q=poker&interest=poker&radius=10");
    expect(searchHref("/search/people", current, { interest: null })).toBe("/search/people?q=poker&radius=5");
    expect(searchHref("/search/activities", {}, { q: "" })).toBe("/search/activities");
    expect(searchHref("/search/people", { q: "a&b" })).toBe("/search/people?q=a%26b");
  });
});

describe("search copy", () => {
  it("people count line", () => {
    expect(peopleCountLine(4, "Poker", 5)).toBe("4 people into poker within 5 km, nearest first");
    expect(peopleCountLine(1, "PS5 / Gaming", 10)).toBe("1 person into PS5 / Gaming within 10 km, nearest first");
    expect(peopleCountLine(0, null, 2)).toBe("0 people within 2 km, nearest first");
  });

  it("activities count line", () => {
    expect(activitiesCountLine(3, "2026-11-28", 5)).toBe("3 activities on Sat 28 Nov within 5 km");
    expect(activitiesCountLine(1, null, 10)).toBe("1 activity on any day within 10 km");
  });

  it("card label", () => {
    expect(mutualLabel(true, 3)).toBe("Connected");
    expect(mutualLabel(false, 1)).toBe("1 mutual");
    expect(mutualLabel(false, 0)).toBe("No mutuals yet");
  });
});
