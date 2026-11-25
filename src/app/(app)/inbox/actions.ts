"use server";

import { requireUser } from "@/server/profile";

/** Viewing the Notifications tab reads everything delivered so far (clears the bell dot on next render). */
export async function markNotificationsRead(): Promise<void> {
  const { supabase } = await requireUser();
  await supabase.rpc("mark_notifications_read");
}
