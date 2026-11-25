import { NextResponse, type NextRequest } from "next/server";
import { requestOrigin } from "@/lib/origin";
import { createClient } from "@/lib/supabase/server";

/** Google OAuth return: exchange the code for a session, then let the proxy route the user. */
export async function GET(request: NextRequest) {
  const origin = requestOrigin(request);
  const code = request.nextUrl.searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  // Fixed same-origin target only — never redirect to a caller-supplied URL.
  const response = NextResponse.redirect(new URL("/", origin), 303);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
