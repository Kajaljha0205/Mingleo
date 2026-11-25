// ST-019.4: interest slug → cover illustration (hosts don't upload covers in V1).
const COVER_SLUGS = new Set([
  "badminton", "swimming", "poker", "boardgames", "gaming", "hike", "cycling",
  "coffee", "shopping", "concert", "music", "movies", "roadtrip", "food",
]);

export function coverFor(slug: string): string | null {
  return COVER_SLUGS.has(slug) ? `/images/covers/${slug}.svg` : null;
}
