import "server-only";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { supabaseEnv } from "@/lib/env";
import {
  firstIncompleteStep,
  ONBOARDING_STEPS,
  resumePath,
  SIGNED_IN_HOME_PATH,
  stepNumber,
  type OnboardingState,
  type StepKey,
} from "@/lib/onboarding";
import { createClient } from "@/lib/supabase/server";

export type Profile = OnboardingState & {
  id: string;
  showAge: boolean;
  bio: string | null;
  city: string | null;
  radiusKm: number;
  discoverRound: number;
};

export type Interest = { id: number; slug: string; name: string };

type Supabase = Awaited<ReturnType<typeof createClient>>;

const PROFILE_COLUMNS =
  "id, first_name, birth_date, show_age, bio, photo_path, area_name, city, radius_km, onboarding_completed_at, discover_round";

/** Signed-in user's id + client, or redirect to S01. */
export async function requireUser(): Promise<{ supabase: Supabase; userId: string }> {
  await connection();
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect("/");
  return { supabase, userId };
}

export async function loadProfile(supabase: Supabase, userId: string): Promise<Profile> {
  const [{ data: row, error }, { data: links }] = await Promise.all([
    supabase.from("users").select(PROFILE_COLUMNS).eq("id", userId).maybeSingle(),
    supabase.from("user_interests").select("interest_id").eq("user_id", userId),
  ]);
  if (error) throw error;
  // The auth trigger creates this row; a missing row means the migration hasn't been run.
  if (!row) throw new Error("Profile row missing — run web/supabase/migrations/0001_onboarding.sql");

  return {
    id: row.id,
    firstName: row.first_name,
    birthDate: row.birth_date,
    showAge: row.show_age,
    bio: row.bio,
    photoPath: row.photo_path,
    areaName: row.area_name,
    city: row.city,
    radiusKm: row.radius_km,
    completedAt: row.onboarding_completed_at,
    discoverRound: row.discover_round ?? 1,
    interestIds: (links ?? []).map((l) => l.interest_id as number),
  };
}

export async function loadInterests(supabase: Supabase): Promise<Interest[]> {
  const { data, error } = await supabase
    .from("interests")
    .select("id, slug, name")
    .order("sort_order");
  if (error) throw error;
  return data;
}

/**
 * Loads the profile for an onboarding step. Users can go back to earlier steps
 * but not skip ahead; finished users leave onboarding.
 */
export async function requireStep(step: StepKey) {
  const { supabase, userId } = await requireUser();
  const profile = await loadProfile(supabase, userId);
  const first = firstIncompleteStep(profile);
  if (first === null) redirect(SIGNED_IN_HOME_PATH);
  if (stepNumber(step) > first) redirect(ONBOARDING_STEPS[first - 1].path);
  return { supabase, userId, profile };
}

/** App pages (S08+): signed in and onboarded, else resume onboarding. */
export async function requireOnboarded() {
  const { supabase, userId } = await requireUser();
  const profile = await loadProfile(supabase, userId);
  if (firstIncompleteStep(profile) !== null) redirect(resumePath(profile));
  return { supabase, userId, profile };
}

export function photoUrl(path: string | null): string | null {
  if (!path) return null;
  // Demo seed people use bundled images under /public.
  if (path.startsWith("/")) return path;
  return `${supabaseEnv().url}/storage/v1/object/public/avatars/${path}`;
}
