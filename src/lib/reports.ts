// ST-192.3 — keep values in sync with the reports.reason check in 0004_discover.sql.
export const REPORT_REASONS = [
  { value: "fake_profile", label: "Fake profile" },
  { value: "inappropriate", label: "Inappropriate photo or bio" },
  { value: "harassment", label: "Harassment or hate" },
  { value: "spam", label: "Spam or scam" },
  { value: "underage", label: "Under 18" },
  { value: "other", label: "Something else" },
] as const;

export const REPORT_NOTE_MAX = 500;
