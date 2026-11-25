import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseEnv } from "@/lib/env";
import { requestOrigin } from "@/lib/origin";

const PROTECTED = [
  "/onboarding",
  "/location",
  "/edit",
  "/discover",
  "/people",
  "/activities",
  "/chats",
  "/search",
  "/inbox",
  "/profile",
  "/settings",
];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, anonKey } = supabaseEnv();

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims);
  const { pathname } = request.nextUrl;

  // S01 is for signed-out visitors; signed-in users resume onboarding (or go home when done).
  const target =
    signedIn && pathname === "/"
      ? "/onboarding"
      : !signedIn && PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`))
        ? "/"
        : null;

  if (target) {
    const redirect = NextResponse.redirect(new URL(target, requestOrigin(request)));
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|images/|favicon.ico|auth/).*)"],
};
