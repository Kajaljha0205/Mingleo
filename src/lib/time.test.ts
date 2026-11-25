import { describe, expect, it } from "vitest";
import {
  addDays,
  cardDateTime,
  clockTime,
  countdown,
  dateKey,
  dateTimeRange,
  dayChip,
  eyebrowDate,
  greeting,
  startsIn,
  zonedTime,
} from "./time";

// 23 Nov 2026, 19:30 in Bengaluru (14:00 UTC).
const NOW = new Date("2026-11-23T14:00:00Z");

describe("time (ST-006, Asia/Kolkata)", () => {
  it("formats the S10 eyebrow and greets by local time", () => {
    expect(eyebrowDate(NOW)).toBe("Monday, 23 November");
    expect(greeting(NOW)).toBe("Good evening");
    expect(greeting(new Date("2026-11-23T03:00:00Z"))).toBe("Good morning"); // 08:30
    expect(greeting(new Date("2026-11-23T08:00:00Z"))).toBe("Good afternoon"); // 13:30
    expect(greeting(new Date("2026-11-22T20:00:00Z"))).toBe("Good evening"); // 01:30
  });

  it("formats card and detail times", () => {
    const start = zonedTime("2026-11-28", "19:00");
    expect(start.toISOString()).toBe("2026-11-28T13:30:00.000Z");
    expect(clockTime(start)).toBe("7:00 PM");
    expect(cardDateTime(start)).toBe("Sat, 28 Nov · 7:00 PM");
    expect(dateTimeRange(zonedTime("2026-11-28", "07:00"), zonedTime("2026-11-28", "09:00"))).toBe("Sat, 28 Nov · 7:00–9:00 AM");
    expect(dateTimeRange(zonedTime("2026-11-28", "11:00"), zonedTime("2026-11-28", "13:00"))).toBe("Sat, 28 Nov · 11:00 AM–1:00 PM");
    expect(dateTimeRange(start, null)).toBe("Sat, 28 Nov · 7:00 PM");
  });

  it("works in local calendar days", () => {
    expect(dateKey(new Date("2026-11-23T19:00:00Z"))).toBe("2026-11-24"); // 00:30 IST next day
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(dayChip("2026-11-26")).toEqual({ weekday: "Thu", day: "26" });
    expect(startsIn(zonedTime("2026-11-28", "07:00"), NOW)).toBe("Starts in 5 days");
    expect(startsIn(zonedTime("2026-11-24", "07:00"), NOW)).toBe("Starts tomorrow");
    expect(startsIn(zonedTime("2026-11-23", "21:00"), NOW)).toBe("Starts today");
  });

  it("formats the Undo countdown", () => {
    expect(countdown(10_000)).toBe("0:10");
    expect(countdown(8_200)).toBe("0:09");
    expect(countdown(-5)).toBe("0:00");
  });
});
