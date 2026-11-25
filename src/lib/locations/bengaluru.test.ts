import { describe, expect, it } from "vitest";
import { findArea, isRadius, nearestArea, searchAreas } from "./bengaluru";

describe("Bengaluru areas", () => {
  it("snaps a nearby position to the closest neighbourhood", () => {
    expect(nearestArea(12.912, 77.645)?.name).toBe("HSR Layout");
    expect(nearestArea(12.9719, 77.6412)?.name).toBe("Indiranagar");
  });

  it("returns null outside the pilot city", () => {
    expect(nearestArea(19.076, 72.8777)).toBeNull(); // Mumbai
  });

  it("searches by name, case-insensitive", () => {
    expect(searchAreas("kora").map((a) => a.slug)).toEqual(["koramangala"]);
    expect(searchAreas("").length).toBeGreaterThan(20);
  });

  it("validates radius and slugs", () => {
    expect(isRadius(5)).toBe(true);
    expect(isRadius(7)).toBe(false);
    expect(findArea("nope")).toBeUndefined();
  });
});
