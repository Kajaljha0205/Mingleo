import { Suspense } from "react";
import {
  OnboardingShell,
  StepHeading,
  StepSkeleton,
} from "@/components/onboarding/OnboardingShell";
import { previousPath, stepNumber } from "@/lib/onboarding";
import { loadInterests, requireStep } from "@/server/profile";
import { InterestsStep } from "./InterestsStep";

export default function InterestsPage({ searchParams }: PageProps<"/onboarding/interests">) {
  return (
    <OnboardingShell step={stepNumber("interests")} backHref={previousPath("interests")}>
      <StepHeading
        title="What are you into?"
        help="Pick at least 3. We use these to suggest people and activities near you."
      />
      <Suspense fallback={<StepSkeleton />}>
        <InterestsLoader searchParams={searchParams} />
      </Suspense>
    </OnboardingShell>
  );
}

async function InterestsLoader({
  searchParams,
}: Pick<PageProps<"/onboarding/interests">, "searchParams">) {
  const { from } = await searchParams;
  const { supabase, profile } = await requireStep("interests");
  const interests = await loadInterests(supabase);
  return (
    <InterestsStep
      // Next keeps visited routes' client state; remount when saved data changes.
      key={profile.interestIds.join(",")}
      interests={interests}
      initialSelected={profile.interestIds}
      from={from === "review" ? "review" : undefined}
    />
  );
}
