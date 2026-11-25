import "server-only";
import type { ChatRow, InboxNotification } from "@/lib/inbox";
import { photoUrl, type Interest } from "@/server/profile";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;
type Row = Record<string, unknown>;

function missing(error: { code?: string } | null, fn: string) {
  if (!error) return;
  if (error.code === "PGRST202" || error.code === "42883") {
    throw new Error(`${fn}() is missing — run web/supabase/migrations/0011_inbox_profile.sql`);
  }
  throw error;
}

export async function loadNotifications(supabase: Supabase): Promise<{ unread: number; items: InboxNotification[] }> {
  const { data, error } = await supabase.rpc("inbox_notifications");
  missing(error, "inbox_notifications");
  const r = (data ?? { unread: 0, items: [] }) as { unread: number; items: Row[] };
  return {
    unread: Number(r.unread),
    items: r.items.map((n) => {
      const a = n.actor as Row | null;
      const act = n.activity as Row | null;
      return {
        id: n.id as string,
        type: n.type as InboxNotification["type"],
        createdAt: n.created_at as string,
        needsReply: Boolean(n.needs_reply),
        actor: a && {
          id: a.id as string,
          firstName: a.first_name as string,
          photoUrl: photoUrl(a.photo_path as string | null),
          connected: Boolean(a.connected),
          distanceKm: Number(a.distance_km),
          sharedCount: Number(a.shared_count),
        },
        activity: act && {
          id: act.id as string,
          title: act.title as string,
          hostFirstName: act.host_first_name as string,
          cancelNote: (act.cancel_note as string | null) ?? null,
        },
      };
    }),
  };
}

export async function loadChats(supabase: Supabase, catalogue: Interest[]): Promise<ChatRow[]> {
  const { data, error } = await supabase.rpc("inbox_conversations");
  missing(error, "inbox_conversations");
  return (data as Row[]).map((c) => {
    const direct = c.type === "direct";
    return {
      id: c.id as string,
      type: c.type as ChatRow["type"],
      href: direct ? `/chats/${c.id}` : `/activities/${c.activity_id}/chat`,
      name: (direct ? c.other_first_name : c.title) as string,
      interestSlug: direct ? null : (catalogue.find((i) => i.id === Number(c.interest_id))?.slug ?? null),
      other: direct
        ? { id: c.other_id as string, firstName: c.other_first_name as string, photoUrl: photoUrl(c.other_photo_path as string | null) }
        : null,
      last: c.last_at
        ? {
            body: c.last_body as string,
            senderId: c.last_sender_id as string,
            senderFirstName: c.last_sender_first_name as string,
            at: c.last_at as string,
          }
        : null,
      unread: Number(c.unread),
    };
  });
}

/** Messages-icon dot; 0 until 0011 is run so the header never breaks the app. */
export async function unreadChatCount(supabase: Supabase): Promise<number> {
  const { data, error } = await supabase.rpc("unread_chat_count");
  return error ? 0 : Number(data ?? 0);
}
