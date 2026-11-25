import { describe, expect, it } from "vitest";
import {
  ageFrom,
  formatBirthdayInput,
  isAdult,
  parseBirthday,
  validateBio,
  validateBirthday,
  validateFirstName,
} from "./validation";

const today = new Date(2026, 10, 23); // 23 Nov 2026

describe("about-you validation", () => {
  it("first name is required, 1–40 characters", () => {
    expect(validateFirstName("  ")).toMatch(/Enter/);
    expect(validateFirstName("A")).toBeNull();
    expect(validateFirstName("x".repeat(40))).toBeNull();
    expect(validateFirstName("x".repeat(41))).toMatch(/40/);
  });

  it("bio max 150", () => {
    expect(validateBio("x".repeat(150))).toBeNull();
    expect(validateBio("x".repeat(151))).toMatch(/150/);
  });

  it("formats typed digits as DD / MM / YYYY", () => {
    expect(formatBirthdayInput("2")).toBe("2");
    expect(formatBirthdayInput("230")).toBe("23 / 0");
    expect(formatBirthdayInput("23/11/1998x9")).toBe("23 / 11 / 1998");
  });

  it("rejects impossible dates", () => {
    expect(parseBirthday("31 / 02 / 2000")).toBeNull();
    expect(parseBirthday("29 / 02 / 2001")).toBeNull();
    expect(parseBirthday("29 / 02 / 2000")).toBe("2000-02-29");
    expect(parseBirthday("00 / 01 / 2000")).toBeNull();
    expect(parseBirthday("01 / 13 / 2000")).toBeNull();
    expect(validateBirthday("01 / 01 / 2030", today)).toMatch(/real date/);
  });

  it("18th birthday today is allowed; one day short is not", () => {
    expect(validateBirthday("23 / 11 / 2008", today)).toBeNull();
    expect(validateBirthday("24 / 11 / 2008", today)).toMatch(/18 or older/);
  });

  it("29 Feb birthdays become adults on 1 Mar in non-leap years (matches Postgres)", () => {
    expect(isAdult("2008-02-29", new Date(2026, 1, 28))).toBe(false);
    expect(isAdult("2008-02-29", new Date(2026, 2, 1))).toBe(true);
  });

  it("computes age", () => {
    expect(ageFrom("1998-11-24", today)).toBe(27);
    expect(ageFrom("1998-11-23", today)).toBe(28);
  });
});
