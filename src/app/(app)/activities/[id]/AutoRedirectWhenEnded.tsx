"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const THREE_HOURS_MS = 3 * 60 * 60 * 1000;
const MAX_TIMER_MS = 24 * 60 * 60 * 1000;

/** Redirects to S17 automatically once the activity's end time (or start + 3 h) passes. */
export function AutoRedirectWhenEnded({
  startsAt,
  endsAt,
  to,
}: {
  startsAt: string;
  endsAt: string | null;
  to: string;
}) {
  const router = useRouter();

  useEffect(() => {
    const endMs = endsAt ? Date.parse(endsAt) : Date.parse(startsAt) + THREE_HOURS_MS;
    if (Number.isNaN(endMs)) return;
    const remaining = endMs - Date.now();
    if (remaining <= 0) {
      router.replace(to);
      return;
    }
    if (remaining > MAX_TIMER_MS) return;
    // Small buffer so the server's clock is also past end time when /after loads.
    const timer = setTimeout(() => router.replace(to), remaining + 500);
    return () => clearTimeout(timer);
  }, [startsAt, endsAt, to, router]);

  return null;
}
