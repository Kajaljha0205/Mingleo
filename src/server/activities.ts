import "server-only";
import type { Visibility } from "@/lib/activity";
import { photoUrl, type Interest } from "@/server/profile";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;
type Row = Record<string, unknown>;

export type Person = { id: string; firstName: string; photoUrl: string | null };

export type ActivitySummary = {
  id: string;
  section: "people" | "nearby";
  interest: Interest;
  title: string;
  host: Person;
  startsAt: string;
  endsAt: string | null;
  areaName: string;
  distanceKm: number;
  limit: number;
  going: number;
  visibility: Visibility;
  viewerState: ViewerState;
};

export type ViewerState = "none" | "requested" | "accepted" | "declined" | "withdrawn" | "closed" | "host";
export type Phase = "open" | "started" | "completed" | "cancelled";

type Base = {
  id: string;
  interest: Interest;
  title: string;
  description: string | null;
  areaName: string;
  city: string;
  /** Exact venue — only present for the host and accepted participants. */
  address: string | null;
  startsAt: string;
  endsAt: string | null;
  limit: number;
  going: number;
  visibility: Visibility;
  phase: Phase;
  cancelNote: string | null;
};

export type ActivityDetails = Base & {
  distanceKm: number;
  viewerState: ViewerState;
  host: Person & { connected: boolean; sharedCount: number; hostedCount: number };
  participants: (Person & { role: "host" | "participant" })[];
};

export type JoinRequest = Person & {
  participationId: string;
  age: number | null;
  connected: boolean;
  distanceKm: number;
  sharedInterests: string[];
};

export type ManageData = Base & {
  requests: JoinRequest[];
  participants: (Person & { role: "host" | "participant"; connected: boolean })[];
};

const person = (id: unknown, firstName: unknown, photo: unknown): Person => ({
  id: id as string,
  firstName: firstName as string,
  photoUrl: photoUrl(photo as string | null),
});

function interestOf(catalogue: Interest[], id: unknown): Interest {
  return catalogue.find((i) => i.id === Number(id)) ?? { id: Number(id), slug: "", name: "Activity" };
}

function base(r: Row, catalogue: Interest[]): Base {
  return {
    id: r.id as string,
    interest: interestOf(catalogue, r.interest_id),
    title: r.title as string,
    description: (r.description as string | null) ?? null,
    areaName: r.area_name as string,
    city: r.city as string,
    address: (r.address as string | null) ?? null,
    startsAt: r.starts_at as string,
    endsAt: (r.ends_at as string | null) ?? null,
    limit: Number(r.participant_limit),
    going: Number(r.going),
    visibility: r.visibility as Visibility,
    phase: r.phase as Phase,
    cancelNote: (r.cancel_note as string | null) ?? null,
  };
}

/** Malformed ids are treated like unknown activities (404). */
function notFoundOrThrow(error: { code?: string }) {
  if (error.code === "22P02") return null;
  throw error;
}

export type ActivityResult = Omit<ActivitySummary, "section">;

/** Row of activities_feed() / search_activities(). */
export function summaryRow(r: Row, catalogue: Interest[]): ActivityResult {
  return {
    id: r.id as string,
    interest: interestOf(catalogue, r.interest_id),
    title: r.title as string,
    host: person(r.host_id, r.host_first_name, r.host_photo_path),
    startsAt: r.starts_at as string,
    endsAt: (r.ends_at as string | null) ?? null,
    areaName: r.area_name as string,
    distanceKm: Number(r.distance_km),
    limit: Number(r.participant_limit),
    going: Number(r.going),
    visibility: r.visibility as Visibility,
    viewerState: r.viewer_state as ViewerState,
  };
}

export async function loadFeed(supabase: Supabase, catalogue: Interest[]): Promise<ActivitySummary[]> {
  const { data, error } = await supabase.rpc("activities_feed");
  if (error) throw error;
  const rows = data as Row[];
  if (rows.length && !("viewer_state" in rows[0])) {
    throw new Error("activities_feed() has no viewer_state — run web/supabase/migrations/0006_feed_viewer_state.sql");
  }
  return rows.map((r) => ({ section: r.section as ActivitySummary["section"], ...summaryRow(r, catalogue) }));
}

export async function loadActivity(supabase: Supabase, id: string, catalogue: Interest[]): Promise<ActivityDetails | null> {
  const { data, error } = await supabase.rpc("activity_details", { p_id: id });
  if (error) return notFoundOrThrow(error);
  if (!data) return null;
  const r = data as Row;
  const h = r.host as Row;
  return {
    ...base(r, catalogue),
    distanceKm: Number(r.distance_km),
    viewerState: r.viewer_state as ViewerState,
    host: {
      ...person(h.id, h.first_name, h.photo_path),
      connected: Boolean(h.connected),
      sharedCount: Number(h.shared_count),
      hostedCount: Number(h.hosted_count),
    },
    participants: (r.participants as Row[]).map((p) => ({
      ...person(p.id, p.first_name, p.photo_path),
      role: p.role as "host" | "participant",
    })),
  };
}

export async function loadManage(supabase: Supabase, id: string, catalogue: Interest[]): Promise<ManageData | null> {
  const { data, error } = await supabase.rpc("manage_activity", { p_id: id });
  if (error) return notFoundOrThrow(error);
  if (!data) return null;
  const r = data as Row;
  return {
    ...base(r, catalogue),
    requests: (r.requests as Row[]).map((q) => ({
      ...person(q.user_id, q.first_name, q.photo_path),
      participationId: q.id as string,
      age: (q.age as number | null) ?? null,
      connected: Boolean(q.connected),
      distanceKm: Number(q.distance_km),
      sharedInterests: (q.shared_interest_ids as number[]).map((i) => interestOf(catalogue, i).name),
    })),
    participants: (r.participants as Row[]).map((p) => ({
      ...person(p.id, p.first_name, p.photo_path),
      role: p.role as "host" | "participant",
      connected: Boolean(p.connected),
    })),
  };
}
