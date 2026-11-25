import type { NextRequest } from "next/server";

/**
 * Public origin of the request. `nextUrl.origin` is always localhost under `next dev`, so for
 * hosts listed in DEV_ORIGINS (e.g. a phone on the LAN) use the Host header instead.
 * Unlisted hosts are ignored to avoid Host-header injection into redirects.
 */
export function requestOrigin(request: NextRequest): string {
  const fallback = request.nextUrl.origin;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!host) return fallback;
  const allowed = (process.env.DEV_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!allowed.includes(host.split(":")[0])) return fallback;
  const proto = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "");
  return `${proto}://${host}`;
}
