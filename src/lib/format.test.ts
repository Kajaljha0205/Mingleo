import { describe, expect, it } from "vitest";
import { currentSection, hidesBottomBar } from "@/components/app/nav";
import { joinNames, profileStatsLine } from "./format";

describe("format", () => {
  it("joins mutual names", () => {
    expect(joinNames(["Priya"])).toBe("Priya");
    expect(joinNames(["Priya", "Rohan"])).toBe("Priya and Rohan");
    expect(joinNames(["Priya", "Rohan", "Sneha", "Kabir"])).toBe("Priya, Rohan and 2 others");
    expect(joinNames(["Priya", "Rohan", "Sneha"])).toBe("Priya, Rohan and 1 other");
  });

  it("omits zero parts of the card stats line", () => {
    expect(profileStatsLine(3, 2)).toBe("Hosted 3 activities · 2 mutual connections");
    expect(profileStatsLine(1, 0)).toBe("Hosted 1 activity");
    expect(profileStatsLine(0, 1)).toBe("1 mutual connection");
    expect(profileStatsLine(0, 0)).toBeNull();
  });

  it("highlights Discover on S08 and S09", () => {
    expect(currentSection("/discover")).toBe("discover");
    expect(currentSection("/people/abc")).toBe("discover");
    expect(currentSection("/search/people")).toBe("search");
    expect(currentSection("/peoplex")).toBeUndefined();
  });

  it("highlights Activities on S10–S15 and hides the bottom bar only in create / edit steps", () => {
    for (const p of ["/activities", "/activities/new", "/activities/x/manage"]) expect(currentSection(p)).toBe("activities");
    for (const p of ["/activities/new", "/activities/new/details", "/activities/x/edit"]) expect(hidesBottomBar(p)).toBe(true);
    for (const p of ["/activities", "/activities/x", "/activities/x/manage", "/activities/newish"]) expect(hidesBottomBar(p)).toBe(false);
  });
});
