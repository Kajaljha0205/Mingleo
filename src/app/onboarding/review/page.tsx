import Link from "next/link";
import { Suspense } from "react";
import {
  OnboardingShell,
  StepHeading,
  StepSkeleton,
} from "@/components/onboarding/OnboardingShell";
import { ProfileCard } from "@/components/cards/ProfileCard";
import { buttonClasses } from "@/components/ui/Button";
import { previousPath, stepNumber } from "@/lib/onboarding";
import { ageFrom } from "@/lib/validation";
import { loadInterests, photoUrl, requireStep } from "@/server/profile";
import { CompleteButton } from "./CompleteButton";

const VERIFIED_LABEL = "Google verified";

export default function ReviewPage() {
  return (
    <OnboardingShell step={stepNumber("review")} backHref={previousPath("review")}>
      <Suspense fallback={<StepSkeleton />}>
        <Review />
      </Suspense>
    </OnboardingShell>
  );
}

async function Review() {
  const { supabase, profile } = await requireStep("review");
  const catalogue = await loadInterests(supabase);
  const interests = catalogue.filter((i) => profile.interestIds.includes(i.id)).map((i) => i.name);
  const name = profile.firstName ?? "";

  return (
    <>
      <StepHeading
        title={`Looking good, ${name}`}
        help="This is how your card appears to people nearby."
      />
      <div className="mt-6">
        <ProfileCard
          photoUrl={photoUrl(profile.photoPath)}
          name={name}
          age={profile.showAge && profile.birthDate ? ageFrom(profile.birthDate) : null}
          verifiedLabel={VERIFIED_LABEL}
          areaName={profile.areaName ?? ""}
          radiusKm={profile.radiusKm}
          bio={profile.bio}
          interests={interests}
          editPhotoHref="/onboarding/photo?from=review"
        />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2.5">
        <Link href="/onboarding/about?from=review" className={buttonClasses("secondary")}>
          Edit details
        </Link>
        <Link href="/onboarding/interests?from=review" className={buttonClasses("secondary")}>
          Edit interests
        </Link>
      </div>
      <CompleteButton />
    </>
  );
}
