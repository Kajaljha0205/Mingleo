import { Suspense } from "react";
import { redirect } from "next/navigation";
import { resumePath } from "@/lib/onboarding";
import { loadProfile, requireUser } from "@/server/profile";

/** Post-auth landing: sends the user to their first incomplete step (or home when done). */
export default function OnboardingIndex() {
  return (
    <Suspense fallback={null}>
      <Resume />
    </Suspense>
  );
}

async function Resume(): Promise<null> {
  const { supabase, userId } = await requireUser();
  redirect(resumePath(await loadProfile(supabase, userId)));
}
