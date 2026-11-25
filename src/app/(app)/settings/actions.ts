"use server";

import { revalidatePath } from "next/cache";
import { isValidSetting, SETTING_COLUMNS } from "@/lib/settings";
import { requireUser } from "@/server/profile";

const FAILED = "Couldn't save. Please try again.";

/** ST-180: one setting per call, saved immediately; every screen reads the new value. */
export async function updateSetting(key: string, value: unknown): Promise<{ error?: string }> {
  if (!isValidSetting(key, value)) return { error: FAILED };
  const { supabase, userId } = await requireUser();
  const { error } = await supabase.from("users").update({ [SETTING_COLUMNS[key]]: value }).eq("id", userId);
  if (error) return { error: FAILED };
  revalidatePath("/", "layout");
  return {};
}

/** ST-191: the connection is not restored. */
export async function unblockPerson(personId: string): Promise<{ error?: string }> {
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("unblock_user", { p_id: personId });
  if (error) return { error: "Couldn't unblock. Please try again." };
  revalidatePath("/", "layout");
  return {};
}
