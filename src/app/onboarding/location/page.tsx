import { Suspense } from "react";
import {
  OnboardingShell,
  StepHeading,
  StepSkeleton,
} from "@/components/onboarding/OnboardingShell";
import { AREAS, DEFAULT_RADIUS, isRadius } from "@/lib/locations/bengaluru";
import { previousPath, stepNumber } from "@/lib/onboarding";
import { requireStep } from "@/server/profile";
import { LocationStep } from "./LocationStep";

export default function LocationPage({ searchParams }: PageProps<"/onboarding/location">) {
  return (
    <OnboardingShell step={stepNumber("location")} backHref={previousPath("location")}>
      <StepHeading
        title="Where should we look?"
        help="Others only see your neighbourhood and an approximate distance, never your exact location."
      />
      <Suspense fallback={<StepSkeleton />}>
        <LocationLoader searchParams={searchParams} />
      </Suspense>
    </OnboardingShell>
  );
}

async function LocationLoader({
  searchParams,
}: Pick<PageProps<"/onboarding/location">, "searchParams">) {
  const { from } = await searchParams;
  const { profile } = await requireStep("location");
  const area = AREAS.find((a) => a.name === profile.areaName);
  return (
    <LocationStep
      key={`${area?.slug}-${profile.radiusKm}`}
      initialAreaSlug={area?.slug ?? null}
      initialRadius={isRadius(profile.radiusKm) ? profile.radiusKm : DEFAULT_RADIUS}
      from={from === "review" ? "review" : undefined}
    />
  );
}
