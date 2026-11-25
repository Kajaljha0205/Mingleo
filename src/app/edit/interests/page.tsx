import { Suspense } from "react";
import { OnboardingShell, StepHeading, StepSkeleton } from "@/components/onboarding/OnboardingShell";
import { loadInterests, requireOnboarded } from "@/server/profile";
import { InterestsStep } from "../../onboarding/interests/InterestsStep";

/** S05 in edit mode (ST-174): same 3-minimum rule; Save returns to S21. */
export default function EditInterestsPage() {
  return (
    <OnboardingShell edit={{ backHref: "/profile", backLabel: "Back to Profile" }}>
      <StepHeading title="What are you into?" help="Pick at least 3. We use these to suggest people and activities near you." />
      <Suspense fallback={<StepSkeleton />}>
        <Interests />
      </Suspense>
    </OnboardingShell>
  );
}

async function Interests() {
  const { supabase, profile } = await requireOnboarded();
  const interests = await loadInterests(supabase);
  return (
    <InterestsStep
      key={profile.interestIds.join(",")}
      interests={interests}
      initialSelected={profile.interestIds}
      from="profile"
      saveLabel="Save"
    />
  );
}
