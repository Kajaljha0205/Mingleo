/** "Priya", "Priya and Rohan", "Priya, Rohan and 2 others". */
export function joinNames(names: string[], max = 2): string {
  if (names.length <= 1) return names[0] ?? "";
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  if (names.length <= max) return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
  const rest = names.length - max;
  return `${names.slice(0, max).join(", ")} and ${rest} ${rest === 1 ? "other" : "others"}`;
}

export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function distanceLabel(km: number): string {
  return `${km.toFixed(1)} km`;
}

/** Card footer: "Hosted 3 activities · 2 mutual connections" (zero parts omitted). */
export function profileStatsLine(hosted: number, mutual: number): string | null {
  const parts = [
    hosted > 0 ? `Hosted ${plural(hosted, "activity", "activities")}` : null,
    mutual > 0 ? plural(mutual, "mutual connection", "mutual connections") : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}
