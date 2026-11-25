import { Suspense } from "react";
import { OnboardingShell, StepHeading, StepSkeleton } from "@/components/onboarding/OnboardingShell";
import { photoUrl, requireOnboarded } from "@/server/profile";
import { PhotoStep } from "../../onboarding/photo/PhotoStep";

/** S04 in edit mode (ST-174): uploads replace the photo straight away; Save returns to S21. */
export default function EditPhotoPage() {
  return (
    <OnboardingShell edit={{ backHref: "/profile", backLabel: "Back to Profile" }}>
      <StepHeading title="Add a photo of you" help="A clear face photo helps people feel comfortable meeting you." />
      <Suspense fallback={<StepSkeleton />}>
        <Photo />
      </Suspense>
    </OnboardingShell>
  );
}

async function Photo() {
  const { profile } = await requireOnboarded();
  return <PhotoStep key={profile.photoPath ?? "none"} initialUrl={photoUrl(profile.photoPath)} nextHref="/profile" saveLabel="Save" />;
}
