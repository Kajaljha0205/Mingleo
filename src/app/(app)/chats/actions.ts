"use server";

import { MESSAGE_MAX, type Msg } from "@/lib/chat";
import { REPORT_NOTE_MAX, REPORT_REASONS } from "@/lib/reports";
import { requireUser } from "@/server/profile";

const MESSAGES: Record<string, string> = {
  read_only: "This chat is read-only now.",
  invalid_body: `Messages can be 1 to ${MESSAGE_MAX} characters.`,
  not_found: "You can't send messages in this chat any more.",
};

function friendly(message: string): string {
  const key = Object.keys(MESSAGES).find((k) => message.includes(k));
  return key ? MESSAGES[key] : "Couldn't send. Please try again.";
}

type Row = { id: string; sender_id: string; body: string; created_at: string };
const toMsg = (r: Row): Msg => ({ id: r.id, senderId: r.sender_id, body: r.body, createdAt: r.created_at });

export async function sendMessage(conversationId: string, body: string): Promise<{ message?: Msg; error?: string }> {
  const text = body.trim();
  if (!text || text.length > MESSAGE_MAX) return { error: MESSAGES.invalid_body };
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("send_message", { p_conversation: conversationId, p_body: text });
  if (error) return { error: friendly(error.message) };
  return { message: toMsg(data as Row) };
}

export async function markRead(conversationId: string): Promise<void> {
  const { supabase } = await requireUser();
  await supabase.rpc("mark_read", { p_conversation: conversationId });
}

export async function loadEarlier(conversationId: string, before: string): Promise<{ messages: Msg[]; hasMore: boolean }> {
  const { supabase } = await requireUser();
  const { data } = await supabase.rpc("chat_thread", { p_conversation: conversationId, p_before: before });
  const r = data as { messages: Row[]; has_more: boolean } | null;
  return { messages: (r?.messages ?? []).map(toMsg), hasMore: Boolean(r?.has_more) };
}

export async function reportActivity(activityId: string, reason: string, note: string): Promise<{ error?: string }> {
  if (!REPORT_REASONS.some((r) => r.value === reason)) return { error: "Choose a reason." };
  if (note.length > REPORT_NOTE_MAX) return { error: `Use ${REPORT_NOTE_MAX} characters or fewer.` };
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("report_activity", { p_id: activityId, p_reason: reason, p_note: note });
  return error ? { error: "Something went wrong. Please try again." } : {};
}
