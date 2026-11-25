import "server-only";
import type { MiniPerson } from "@/server/discover";
import { photoUrl, type Interest } from "@/server/profile";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;
type Row = Record<string, unknown>;

export type ProfileTab = "created" | "joined" | "past";

export type MyActivity = {
  id: string;
  interest: Interest;
  title: string;
  startsAt: string;
  limit: number;
  going: number;
  phase: "open" | "started" | "completed" | "cancelled";
  tab: ProfileTab;
  myStatus: "host" | "accepted" | "requested" | "closed";
  hostFirstName: string;
};

export type MyProfileData = {
  connectionsCount: number;
  createdCount: number;
  joinedCount: number;
  pendingCount: number;
  connectionsPreview: MiniPerson[];
  activities: MyActivity[];
};

export type ConnectionsData = {
  pending: (MiniPerson & { areaName: string; distanceKm: number; sharedCount: number })[];
  connections: (MiniPerson & { areaName: string })[];
};

function missing(error: { code?: string } | null, fn: string) {
  if (!error) return;
  if (error.code === "PGRST202" || error.code === "42883") {
    throw new Error(`${fn}() is missing — run web/supabase/migrations/0011_inbox_profile.sql`);
  }
  throw error;
}

const mini = (r: Row): MiniPerson => ({
  id: r.id as string,
  firstName: r.first_name as string,
  photoUrl: photoUrl(r.photo_path as string | null),
});

export async function loadMyProfile(supabase: Supabase, catalogue: Interest[]): Promise<MyProfileData> {
  const { data, error } = await supabase.rpc("my_profile");
  missing(error, "my_profile");
  const r = data as Row;
  return {
    connectionsCount: Number(r.connections_count),
    createdCount: Number(r.created_count),
    joinedCount: Number(r.joined_count),
    pendingCount: Number(r.pending_count),
    connectionsPreview: (r.connections_preview as Row[]).map(mini),
    activities: (r.activities as Row[]).map((a) => ({
      id: a.id as string,
      interest: catalogue.find((i) => i.id === Number(a.interest_id)) ?? { id: Number(a.interest_id), slug: "", name: "Activity" },
      title: a.title as string,
      startsAt: a.starts_at as string,
      limit: Number(a.participant_limit),
      going: Number(a.going),
      phase: a.phase as MyActivity["phase"],
      tab: a.tab as ProfileTab,
      myStatus: a.my_status as MyActivity["myStatus"],
      hostFirstName: a.host_first_name as string,
    })),
  };
}

export async function loadMyConnections(supabase: Supabase): Promise<ConnectionsData> {
  const { data, error } = await supabase.rpc("my_connections");
  missing(error, "my_connections");
  const r = data as { pending: Row[]; connections: Row[] };
  return {
    pending: r.pending.map((p) => ({
      ...mini(p),
      areaName: p.area_name as string,
      distanceKm: Number(p.distance_km),
      sharedCount: Number(p.shared_count),
    })),
    connections: r.connections.map((c) => ({ ...mini(c), areaName: c.area_name as string })),
  };
}
