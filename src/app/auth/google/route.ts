import { NextResponse, type NextRequest } from "next/server";
import { requestOrigin } from "@/lib/origin";
import { createClient } from "@/lib/supabase/server";

/** Starts Google OAuth (PKCE). The S01 button posts here. */
export async function POST(request: NextRequest) {
  const origin = requestOrigin(request);
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/google/callback`,
      skipBrowserRedirect: true,
    },
  });

  const target = error || !data.url ? new URL("/", origin) : data.url;
  const response = NextResponse.redirect(target, 303);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
