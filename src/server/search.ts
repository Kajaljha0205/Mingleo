import "server-only";
import { orderInterests, type Relationship } from "@/server/discover";
import { summaryRow, type ActivityResult } from "@/server/activities";
import { photoUrl, type Interest } from "@/server/profile";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;
type Row = Record<string, unknown>;

export type PersonResult = {
  id: string;
  firstName: string;
  age: number | null;
  photoUrl: string | null;
  areaName: string;
  distanceKm: number;
  /** Shared interests first. */
  interests: { name: string; shared: boolean }[];
  mutualCount: number;
  relationship: Relationship;
};

const MISSING = "run web/supabase/migrations/0010_search.sql";

function check(error: { code?: string; message: string } | null, fn: string) {
  if (!error) return;
  if (error.code === "PGRST202" || error.code === "42883") throw new Error(`${fn}() is missing — ${MISSING}`);
  throw error;
}

export async function searchPeople(
  supabase: Supabase,
  f: { q: string; interestId: number | null },
  viewerInterestIds: number[],
  catalogue: Interest[],
): Promise<PersonResult[]> {
  const { data, error } = await supabase.rpc("search_people", {
    p_text: f.q || null,
    p_interest_id: f.interestId,
  });
  check(error, "search_people");
  return (data as Row[]).map((r) => ({
    id: r.id as string,
    firstName: r.first_name as string,
    age: (r.age as number | null) ?? null,
    photoUrl: photoUrl(r.photo_path as string | null),
    areaName: r.area_name as string,
    distanceKm: Number(r.distance_km),
    interests: orderInterests(r.interest_ids as number[], viewerInterestIds, catalogue),
    mutualCount: Number(r.mutual_count),
    relationship: r.relationship as Relationship,
  }));
}

export async function searchActivities(
  supabase: Supabase,
  f: { q: string; interestId: number | null; date: string | null; fromPeople: boolean },
  catalogue: Interest[],
): Promise<ActivityResult[]> {
  const { data, error } = await supabase.rpc("search_activities", {
    p_text: f.q || null,
    p_interest_id: f.interestId,
    p_date: f.date,
    p_from_people: f.fromPeople,
  });
  check(error, "search_activities");
  return (data as Row[]).map((r) => summaryRow(r, catalogue));
}
