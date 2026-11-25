"use server";

import { revalidatePath } from "next/cache";
import {
  CANCEL_NOTE_MAX,
  validateDraft,
  validateStepOne,
  type Draft,
  type DraftErrors,
} from "@/lib/activity";
import { CITY, findArea } from "@/lib/locations/bengaluru";
import { zonedTime } from "@/lib/time";
import type { ViewerState } from "@/server/activities";
import { requireUser } from "@/server/profile";

const MESSAGES: Record<string, string> = {
  full: "This activity is full.",
  closed: "This activity isn't taking requests any more.",
  declined: "The host couldn't fit you in this time.",
  too_late: "Too late to undo. The decline has gone through.",
  start_in_past: "Start time has passed. Pick a later time.",
  not_found: "This activity isn't available any more.",
};

function friendly(message: string): string {
  const key = Object.keys(MESSAGES).find((k) => message.includes(k));
  return key ? MESSAGES[key] : "Something went wrong. Please try again.";
}

type Result = { error?: string };

async function call(fn: string, args: Record<string, unknown>): Promise<{ data?: unknown; error?: string }> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc(fn, args);
  if (error) return { error: friendly(error.message) };
  revalidatePath("/activities", "layout");
  revalidatePath("/search/activities");
  return { data };
}

export async function createActivity(draft: Draft): Promise<{ id?: string; error?: string; errors?: DraftErrors }> {
  const errors = validateDraft(draft, new Date());
  if (Object.keys(errors).length) return { errors };
  // Area coordinates come from the curated list, never from the browser.
  const area = findArea(draft.areaSlug!)!;
  const { data, error } = await call("create_activity", {
    p_interest_id: draft.interestId,
    p_title: draft.title.trim(),
    p_description: draft.details.trim(),
    p_area_name: area.name,
    p_city: CITY,
    p_lat: area.lat,
    p_lng: area.lng,
    p_address: draft.address.trim(),
    p_starts_at: zonedTime(draft.date!, draft.start).toISOString(),
    p_ends_at: draft.end ? zonedTime(draft.date!, draft.end).toISOString() : null,
    p_limit: draft.limit,
    p_visibility: draft.visibility,
  });
  return error ? { error } : { id: data as string };
}

/** ST-114: only title and details are accepted. */
export async function updateActivityDetails(id: string, title: string, details: string): Promise<Result & { errors?: DraftErrors }> {
  const errors = validateStepOne({ interestId: 1, title, details });
  if (Object.keys(errors).length) return { errors };
  const { error } = await call("update_activity_details", { p_id: id, p_title: title.trim(), p_description: details.trim() });
  return { error };
}

export async function requestToJoin(id: string): Promise<{ state?: ViewerState; error?: string }> {
  const { data, error } = await call("request_to_join", { p_id: id });
  return error ? { error } : { state: data as ViewerState };
}

export async function withdrawJoinRequest(id: string): Promise<{ state?: ViewerState; error?: string }> {
  const { error } = await call("withdraw_join_request", { p_id: id });
  return error ? { error } : { state: "none" };
}

export async function withdrawFromActivity(id: string): Promise<{ state?: ViewerState; error?: string }> {
  const { error } = await call("withdraw_from_activity", { p_id: id });
  return error ? { error } : { state: "withdrawn" };
}

export async function acceptRequest(participationId: string): Promise<Result> {
  return { error: (await call("accept_join_request", { p_participation: participationId })).error };
}

export async function declineRequest(participationId: string): Promise<Result> {
  return { error: (await call("decline_join_request", { p_participation: participationId })).error };
}

export async function undoDecline(participationId: string): Promise<Result> {
  return { error: (await call("undo_decline", { p_participation: participationId })).error };
}

export async function cancelActivity(id: string, note: string): Promise<Result> {
  if (note.length > CANCEL_NOTE_MAX) return { error: `Use ${CANCEL_NOTE_MAX} characters or fewer.` };
  return { error: (await call("cancel_activity", { p_id: id, p_note: note.trim() })).error };
}
