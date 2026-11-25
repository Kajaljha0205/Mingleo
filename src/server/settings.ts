import "server-only";
import { isRadius } from "@/lib/locations/bengaluru";
import type { HistoryVisibility, Settings } from "@/lib/settings";
import type { MiniPerson } from "@/server/discover";
import { photoUrl } from "@/server/profile";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export async function loadSettings(supabase: Supabase, userId: string): Promise<Settings> {
  const { data, error } = await supabase
    .from("users")
    .select("radius_km, discoverable, show_age, history_visibility, notify_connection_requests, notify_new_activities, notify_join_decisions, notify_request_declined")
    .eq("id", userId)
    .single();
  if (error) throw error;
  return {
    radiusKm: isRadius(data.radius_km) ? data.radius_km : 5,
    discoverable: data.discoverable,
    showAge: data.show_age,
    historyVisibility: data.history_visibility as HistoryVisibility,
    notifyConnectionRequests: data.notify_connection_requests,
    notifyNewActivities: data.notify_new_activities,
    notifyJoinDecisions: data.notify_join_decisions,
    notifyRequestDeclined: data.notify_request_declined,
  };
}

export async function loadBlocked(supabase: Supabase): Promise<MiniPerson[]> {
  const { data, error } = await supabase.rpc("blocked_people");
  if (error) {
    if (error.code === "PGRST202" || error.code === "42883") {
      throw new Error("blocked_people() is missing — run web/supabase/migrations/0012_settings.sql");
    }
    throw error;
  }
  return (data as { id: string; first_name: string; photo_path: string | null }[]).map((r) => ({
    id: r.id,
    firstName: r.first_name,
    photoUrl: photoUrl(r.photo_path),
  }));
}
