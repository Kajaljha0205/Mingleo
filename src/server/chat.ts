import "server-only";
import { photoUrl, type Interest } from "@/server/profile";
import type { createClient } from "@/lib/supabase/server";
import type { Relationship } from "@/server/discover";
import type { Visibility } from "@/lib/activity";
import type { Phase } from "@/server/activities";

type Supabase = Awaited<ReturnType<typeof createClient>>;
type Row = Record<string, unknown>;

export type ChatMessage = { id: string; senderId: string; body: string; createdAt: string };
export type ChatMember = { id: string; firstName: string; photoUrl: string | null; isHost: boolean; lastReadAt: string | null };
export type ReadOnlyReason = "cancelled" | "closed" | "ended" | null;

export type ChatThread = {
  id: string;
  type: "activity" | "direct";
  readOnly: ReadOnlyReason;
  members: ChatMember[];
  messages: ChatMessage[];
  hasMore: boolean;
  lastOwnId: string | null;
  seenBy: number;
  activity: {
    id: string;
    interest: Interest;
    title: string;
    startsAt: string;
    endsAt: string | null;
    areaName: string;
    address: string | null;
    distanceKm: number;
    limit: number;
    going: number;
    phase: Phase;
    hostId: string;
    hostFirstName: string;
    viewerRole: "host" | "participant";
  } | null;
  other: { id: string; firstName: string; photoUrl: string | null } | null;
};

export function toMessage(r: Row): ChatMessage {
  return { id: r.id as string, senderId: r.sender_id as string, body: r.body as string, createdAt: r.created_at as string };
}

/** Malformed ids are treated like unknown chats (404). */
function nullOnBadId(error: { code?: string }) {
  if (error.code === "22P02") return null;
  throw error;
}

export async function activityConversationId(supabase: Supabase, activityId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc("activity_conversation", { p_activity: activityId });
  if (error) return nullOnBadId(error);
  return (data as string | null) ?? null;
}

export async function directConversationId(supabase: Supabase, otherId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc("direct_conversation", { p_other: otherId });
  if (error) return nullOnBadId(error);
  return (data as string | null) ?? null;
}

export async function loadThread(supabase: Supabase, id: string, catalogue: Interest[]): Promise<ChatThread | null> {
  const { data, error } = await supabase.rpc("chat_thread", { p_conversation: id });
  if (error) return nullOnBadId(error);
  if (!data) return null;
  // RLS (0009): members only, never across a block.
  const { data: reads } = await supabase.from("conversation_members").select("user_id, last_read_at").eq("conversation_id", id);
  const readAt = new Map((reads ?? []).map((x) => [x.user_id as string, x.last_read_at as string]));
  const r = data as Row;
  const a = r.activity as Row | null;
  const o = r.other as Row | null;
  return {
    id: r.id as string,
    type: r.type as ChatThread["type"],
    readOnly: (r.read_only as ReadOnlyReason) ?? null,
    members: (r.members as Row[]).map((m) => ({
      id: m.id as string,
      firstName: m.first_name as string,
      photoUrl: photoUrl(m.photo_path as string | null),
      isHost: Boolean(m.is_host),
      lastReadAt: readAt.get(m.id as string) ?? null,
    })),
    messages: (r.messages as Row[]).map(toMessage),
    hasMore: Boolean(r.has_more),
    lastOwnId: (r.last_own_id as string | null) ?? null,
    seenBy: Number(r.seen_by ?? 0),
    activity: a && {
      id: a.id as string,
      interest: catalogue.find((i) => i.id === Number(a.interest_id)) ?? { id: Number(a.interest_id), slug: "", name: "Activity" },
      title: a.title as string,
      startsAt: a.starts_at as string,
      endsAt: (a.ends_at as string | null) ?? null,
      areaName: a.area_name as string,
      address: (a.address as string | null) ?? null,
      distanceKm: Number(a.distance_km),
      limit: Number(a.participant_limit),
      going: Number(a.going),
      phase: a.phase as Phase,
      hostId: a.host_id as string,
      hostFirstName: a.host_first_name as string,
      viewerRole: a.viewer_role as "host" | "participant",
    },
    other: o && { id: o.id as string, firstName: o.first_name as string, photoUrl: photoUrl(o.photo_path as string | null) },
  };
}

export type AfterActivity = {
  id: string;
  interest: Interest;
  title: string;
  description: string | null;
  areaName: string;
  address: string | null;
  startsAt: string;
  limit: number;
  visibility: Visibility;
  phase: Phase;
  viewerFirstName: string;
  chatReadOnly: ReadOnlyReason;
  participants: {
    id: string;
    firstName: string;
    photoUrl: string | null;
    isHost: boolean;
    relationship: Relationship;
    together: number;
  }[];
};

export async function loadAfterActivity(supabase: Supabase, id: string, catalogue: Interest[]): Promise<AfterActivity | null> {
  const { data, error } = await supabase.rpc("after_activity", { p_id: id });
  if (error) return nullOnBadId(error);
  if (!data) return null;
  const r = data as Row;
  return {
    id: r.id as string,
    interest: catalogue.find((i) => i.id === Number(r.interest_id)) ?? { id: Number(r.interest_id), slug: "", name: "Activity" },
    title: r.title as string,
    description: (r.description as string | null) ?? null,
    areaName: r.area_name as string,
    address: (r.address as string | null) ?? null,
    startsAt: r.starts_at as string,
    limit: Number(r.participant_limit),
    visibility: r.visibility as Visibility,
    phase: r.phase as Phase,
    viewerFirstName: r.viewer_first_name as string,
    chatReadOnly: (r.chat_read_only as ReadOnlyReason) ?? null,
    participants: (r.participants as Row[]).map((p) => ({
      id: p.id as string,
      firstName: p.first_name as string,
      photoUrl: photoUrl(p.photo_path as string | null),
      isHost: Boolean(p.is_host),
      relationship: p.relationship as Relationship,
      together: Number(p.together),
    })),
  };
}
