"use server";

import { revalidatePath } from "next/cache";
import { CONNECT_DAILY_LIMIT, REQUEST_COOLDOWN_DAYS } from "@/lib/config";
import { REPORT_NOTE_MAX, REPORT_REASONS } from "@/lib/reports";
import type { Relationship } from "@/server/discover";
import { requireUser } from "@/server/profile";

export type ConnectionResult = { state: Relationship; error?: undefined } | { state?: undefined; error: string };

const MESSAGES: Record<string, string> = {
  rate_limited: `You've sent ${CONNECT_DAILY_LIMIT} requests today. Try again tomorrow.`,
  cooldown: `They declined recently. You can ask again ${REQUEST_COOLDOWN_DAYS} days after.`,
  not_found: "This person isn't available any more.",
  too_late: "Too late to undo.",
};

function friendly(message: string): string {
  const key = Object.keys(MESSAGES).find((k) => message.includes(k));
  return key ? MESSAGES[key] : "Something went wrong. Please try again.";
}

async function call(fn: string, args: Record<string, unknown>): Promise<ConnectionResult> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc(fn, args);
  if (error) return { error: friendly(error.message) };
  revalidatePath("/discover");
  revalidatePath("/people/[id]", "page");
  revalidatePath("/search/people");
  revalidatePath("/inbox");
  revalidatePath("/profile", "layout");
  return { state: (data as Relationship | null) ?? "none" };
}

export async function removeConnection(personId: string) {
  return call("remove_connection", { p_other: personId });
}

/** Inbox / connections list Undo after Decline (10 s window, enforced in SQL). */
export async function undoConnectionDecline(personId: string) {
  return call("undo_connection_decline", { p_from: personId });
}

export async function connect(personId: string) {
  return call("send_connection_request", { p_to: personId });
}

export async function withdrawRequest(personId: string) {
  return call("withdraw_connection_request", { p_to: personId });
}

export async function respondToRequest(personId: string, accept: boolean) {
  return call("respond_connection_request", { p_from: personId, p_accept: accept });
}

export async function skip(personId: string): Promise<{ error?: string }> {
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("skip_profile", { p_id: personId });
  return error ? { error: friendly(error.message) } : {};
}

export async function startOver(): Promise<{ error?: string }> {
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("start_over_discover");
  if (error) return { error: friendly(error.message) };
  revalidatePath("/discover");
  return {};
}

export async function blockPerson(personId: string): Promise<{ error?: string }> {
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("block_user", { p_id: personId });
  if (error) return { error: friendly(error.message) };
  revalidatePath("/discover");
  revalidatePath("/people/[id]", "page");
  revalidatePath("/search", "layout");
  return {};
}

export async function reportPerson(
  personId: string,
  reason: string,
  note: string,
): Promise<{ error?: string }> {
  if (!REPORT_REASONS.some((r) => r.value === reason)) return { error: "Choose a reason." };
  if (note.length > REPORT_NOTE_MAX) return { error: `Use ${REPORT_NOTE_MAX} characters or fewer.` };
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("report_user", { p_id: personId, p_reason: reason, p_note: note });
  return error ? { error: friendly(error.message) } : {};
}
