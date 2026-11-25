import "server-only";
import { DISCOVER_BATCH, DISCOVER_WEIGHTS } from "@/lib/config";
import { photoUrl, type Interest } from "@/server/profile";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type MiniPerson = { id: string; firstName: string; photoUrl: string | null };

export type RecentActivity = {
  id: string;
  title: string;
  role: "Hosted" | "Joined";
  people: number;
  when: string;
  interestSlug: string;
};

export type Candidate = {
  id: string;
  firstName: string;
  age: number | null;
  photoUrl: string | null;
  areaName: string;
  distanceKm: number;
  bio: string | null;
  /** Shared interests first, then the rest. */
  interests: { name: string; shared: boolean }[];
  sharedCount: number;
  mutual: MiniPerson[];
  hostedCount: number;
  recentActivities: RecentActivity[];
};

export type Relationship = "none" | "sent" | "received" | "connected";

export type PersonProfile = Candidate & { relationship: Relationship; historyVisible: boolean };

type MutualRow = { id: string; first_name: string; photo_path: string | null };

function toMini(rows: MutualRow[] | null): MiniPerson[] {
  return (rows ?? []).map((m) => ({ id: m.id, firstName: m.first_name, photoUrl: photoUrl(m.photo_path) }));
}

export function orderInterests(ids: number[], viewerIds: number[], catalogue: Interest[]) {
  const mine = new Set(viewerIds);
  const named = catalogue.filter((i) => ids.includes(i.id));
  return [
    ...named.filter((i) => mine.has(i.id)).map((i) => ({ name: i.name, shared: true })),
    ...named.filter((i) => !mine.has(i.id)).map((i) => ({ name: i.name, shared: false })),
  ];
}

export async function loadCandidates(
  supabase: Supabase,
  viewerInterestIds: number[],
  catalogue: Interest[],
  interestId: number | null,
): Promise<Candidate[]> {
  const { data, error } = await supabase.rpc("discover_candidates", {
    p_interest_id: interestId,
    p_w_sim: DISCOVER_WEIGHTS.similarity,
    p_w_dist: DISCOVER_WEIGHTS.distance,
    p_limit: DISCOVER_BATCH,
  });
  if (error) throw error;
  return (data as Record<string, unknown>[]).map((r) => ({
    id: r.id as string,
    firstName: r.first_name as string,
    age: (r.age as number | null) ?? null,
    photoUrl: photoUrl(r.photo_path as string | null),
    areaName: r.area_name as string,
    distanceKm: Number(r.distance_km),
    bio: (r.bio as string | null) ?? null,
    interests: orderInterests(r.interest_ids as number[], viewerInterestIds, catalogue),
    sharedCount: r.shared_count as number,
    mutual: toMini(r.mutual as MutualRow[]),
    hostedCount: (r.hosted_count as number) ?? 0,
    recentActivities: [],
  }));
}

export async function loadPerson(
  supabase: Supabase,
  id: string,
  catalogue: Interest[],
): Promise<PersonProfile | null> {
  const { data, error } = await supabase.rpc("person_profile", { p_id: id });
  if (error) {
    // Malformed ids are treated like unknown people (404).
    if (error.code === "22P02") return null;
    throw error;
  }
  if (!data) return null;
  const r = data as Record<string, unknown>;
  const ids = r.interest_ids as number[];
  const viewerIds = r.viewer_interest_ids as number[];
  return {
    id: r.id as string,
    firstName: r.first_name as string,
    age: (r.age as number | null) ?? null,
    photoUrl: photoUrl(r.photo_path as string | null),
    areaName: r.area_name as string,
    distanceKm: Number(r.distance_km),
    bio: (r.bio as string | null) ?? null,
    interests: orderInterests(ids, viewerIds, catalogue),
    sharedCount: ids.filter((i) => viewerIds.includes(i)).length,
    mutual: toMini(r.mutual as MutualRow[]),
    hostedCount: (r.hosted_count as number) ?? 0,
    historyVisible: Boolean(r.history_visible),
    recentActivities: r.history_visible ? ((r.recent_activities as RecentActivity[]) ?? []) : [],
    relationship: r.relationship as Relationship,
  };
}

export async function unreadCount(supabase: Supabase, userId: string): Promise<number> {
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("read_at", null);
  return count ?? 0;
}
