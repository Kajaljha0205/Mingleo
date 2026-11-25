import { Suspense } from "react";
import {
  OnboardingShell,
  StepHeading,
  StepSkeleton,
} from "@/components/onboarding/OnboardingShell";
import { nextPath, previousPath, stepNumber } from "@/lib/onboarding";
import { photoUrl, requireStep } from "@/server/profile";
import { PhotoStep } from "./PhotoStep";

export default function PhotoPage({ searchParams }: PageProps<"/onboarding/photo">) {
  return (
    <OnboardingShell step={stepNumber("photo")} backHref={previousPath("photo")}>
      <StepHeading
        title="Add a photo of you"
        help="A clear face photo helps people feel comfortable meeting you."
      />
      <Suspense fallback={<StepSkeleton />}>
        <PhotoLoader searchParams={searchParams} />
      </Suspense>
    </OnboardingShell>
  );
}

async function PhotoLoader({ searchParams }: Pick<PageProps<"/onboarding/photo">, "searchParams">) {
  const { from } = await searchParams;
  const { profile } = await requireStep("photo");
  return (
    <PhotoStep
      key={profile.photoPath ?? "none"}
      initialUrl={photoUrl(profile.photoPath)}
      nextHref={nextPath("photo", typeof from === "string" ? from : undefined)}
    />
  );
}
