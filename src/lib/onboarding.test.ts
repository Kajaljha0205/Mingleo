import { describe, expect, it } from "vitest";
import {
  firstIncompleteStep,
  nextPath,
  previousPath,
  resumePath,
  type OnboardingState,
} from "./onboarding";

const empty: OnboardingState = {
  firstName: "Aarav",
  birthDate: null,
  photoPath: null,
  interestIds: [],
  areaName: null,
  completedAt: null,
};

describe("onboarding routing", () => {
  it("resumes at the first incomplete step", () => {
    expect(firstIncompleteStep({ ...empty, firstName: null })).toBe(1);
    // A Google-prefilled name alone doesn't complete About you.
    expect(resumePath(empty)).toBe("/onboarding/about");
    const about = { ...empty, birthDate: "1998-01-01" };
    expect(resumePath(about)).toBe("/onboarding/photo");
    const photo = { ...about, photoPath: "u/p.webp" };
    expect(resumePath({ ...photo, interestIds: [1, 2] })).toBe("/onboarding/interests");
    const interests = { ...photo, interestIds: [1, 2, 3] };
    expect(resumePath(interests)).toBe("/onboarding/location");
    const location = { ...interests, areaName: "HSR Layout" };
    expect(resumePath(location)).toBe("/onboarding/review");
    expect(resumePath({ ...location, completedAt: "2026-11-23T00:00:00Z" })).toBe("/activities");
  });

  it("Continue goes to the next step, or back to review when editing", () => {
    expect(nextPath("about", undefined)).toBe("/onboarding/photo");
    expect(nextPath("location", null)).toBe("/onboarding/review");
    expect(nextPath("about", "review")).toBe("/onboarding/review");
    expect(nextPath("interests", "https://evil.test")).toBe("/onboarding/location");
    expect(nextPath("location", "discover")).toBe("/discover");
  });

  it("back goes to the previous step; none on the first", () => {
    expect(previousPath("about")).toBeUndefined();
    expect(previousPath("photo")).toBe("/onboarding/about");
    expect(previousPath("review")).toBe("/onboarding/location");
  });
});
