import { isRadius, type RadiusKm } from "@/lib/locations/bengaluru";

export type HistoryVisibility = "connections" | "nearby" | "only_me";

export type Settings = {
  radiusKm: RadiusKm;
  discoverable: boolean;
  showAge: boolean;
  historyVisibility: HistoryVisibility;
  notifyConnectionRequests: boolean;
  notifyNewActivities: boolean;
  notifyJoinDecisions: boolean;
  notifyRequestDeclined: boolean;
};

export type SettingKey = keyof Settings;

/** users table column per setting (all granted for update to the signed-in user). */
export const SETTING_COLUMNS: Record<SettingKey, string> = {
  radiusKm: "radius_km",
  discoverable: "discoverable",
  showAge: "show_age",
  historyVisibility: "history_visibility",
  notifyConnectionRequests: "notify_connection_requests",
  notifyNewActivities: "notify_new_activities",
  notifyJoinDecisions: "notify_join_decisions",
  notifyRequestDeclined: "notify_request_declined",
};

export const HISTORY_OPTIONS: { value: HistoryVisibility; label: string }[] = [
  { value: "connections", label: "Connections" },
  { value: "nearby", label: "Everyone nearby" },
  { value: "only_me", label: "Only me" },
];

/** §12 toggles, in S22 order (defaults: on, on, on, off). */
export const NOTIFY_TOGGLES: { key: SettingKey; label: string }[] = [
  { key: "notifyConnectionRequests", label: "Connection requests" },
  { key: "notifyNewActivities", label: "New activities from connections" },
  { key: "notifyJoinDecisions", label: "Join decisions and cancellations" },
  { key: "notifyRequestDeclined", label: "When a request is declined" },
];

export function isValidSetting(key: string, value: unknown): key is SettingKey {
  if (!(key in SETTING_COLUMNS)) return false;
  if (key === "radiusKm") return typeof value === "number" && isRadius(value);
  if (key === "historyVisibility") return HISTORY_OPTIONS.some((o) => o.value === value);
  return typeof value === "boolean";
}

export function discoverableHelp(on: boolean): string {
  return on ? "People nearby can find you and send requests" : "Hidden. Existing connections are unaffected";
}
