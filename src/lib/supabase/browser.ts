"use client";

import { createBrowserClient } from "@supabase/ssr";
import { supabaseEnv } from "@/lib/env";

let client: ReturnType<typeof createBrowserClient> | null = null;

/** Browser client (session from the auth cookies) — used only for Realtime chat delivery. */
export function browserClient() {
  if (!client) {
    const { url, anonKey } = supabaseEnv();
    client = createBrowserClient(url, anonKey);
  }
  return client;
}
