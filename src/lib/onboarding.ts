import { isOrigin, ORIGINS } from "./origins";

export const ONBOARDING_STEPS = [
  { key: "about", label: "About you", path: "/onboarding/about" },
  { key: "photo", label: "Photo", path: "/onboarding/photo" },
  { key: "interests", label: "Interests", path: "/onboarding/interests" },
  { key: "location", label: "Location", path: "/onboarding/location" },
  { key: "review", label: "Review", path: "/onboarding/review" },
] as const;

export type StepKey = (typeof ONBOARDING_STEPS)[number]["key"];

export const MIN_INTERESTS = 3;
// §16: land on Discover right after onboarding.
export const AFTER_ONBOARDING_PATH = "/discover";
// Returning signed-in users land on S10 Activities (ST-035).
export const SIGNED_IN_HOME_PATH = "/activities";

export type OnboardingState = {
  firstName: string | null;
  birthDate: string | null;
  photoPath: string | null;
  interestIds: number[];
  areaName: string | null;
  completedAt: string | null;
};

export function stepNumber(key: StepKey): number {
  return ONBOARDING_STEPS.findIndex((s) => s.key === key) + 1;
}

/** 1-based number of the first step still to do, or null when onboarding is complete. */
export function firstIncompleteStep(s: OnboardingState): number | null {
  if (s.completedAt) return null;
  if (!s.firstName || !s.birthDate) return 1;
  if (!s.photoPath) return 2;
  if (s.interestIds.length < MIN_INTERESTS) return 3;
  if (!s.areaName) return 4;
  return 5;
}

export function resumePath(s: OnboardingState): string {
  const n = firstIncompleteStep(s);
  return n === null ? SIGNED_IN_HOME_PATH : ONBOARDING_STEPS[n - 1].path;
}

/** Where Continue goes: back to review / the edit-mode origin, else the next step. */
export function nextPath(current: StepKey, from: string | null | undefined): string {
  if (from === "review") return "/onboarding/review";
  if (isOrigin(from)) return ORIGINS[from].href;
  return ONBOARDING_STEPS[stepNumber(current)]?.path ?? AFTER_ONBOARDING_PATH;
}

export function previousPath(current: StepKey): string | undefined {
  const n = stepNumber(current);
  return n > 1 ? ONBOARDING_STEPS[n - 2].path : undefined;
}
