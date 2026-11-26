import { Suspense } from "react";
import {
  OnboardingShell,
  StepHeading,
  StepSkeleton,
} from "@/components/onboarding/OnboardingShell";
import { AREAS, DEFAULT_RADIUS, isRadius } from "@/lib/locations/bengaluru";
import { isOrigin, originFrom, withBackQuery } from "@/lib/origins";
import { requireOnboarded } from "@/server/profile";
import { LocationStep } from "../onboarding/location/LocationStep";

/** S06 in edit mode (ST-203): opened from the location chip; Save returns to the origin. */
export default function EditLocationPage({ searchParams }: PageProps<"/location">) {
  return (
    <Suspense fallback={<StepSkeleton />}>
      <EditLocation searchParams={searchParams} />
    </Suspense>
  );
}

async function EditLocation({ searchParams }: Pick<PageProps<"/location">, "searchParams">) {
  const { from, back } = await searchParams;
  const origin = originFrom(from);
  const { profile } = await requireOnboarded();
  const area = AREAS.find((a) => a.name === profile.areaName);
  return (
    <OnboardingShell edit={{ backHref: withBackQuery(origin.href, from, back), backLabel: `Back to ${origin.label}` }}>
      <StepHeading
        title="Where should we look?"
        help="Others only see your neighbourhood and an approximate distance, never your exact location."
      />
      <LocationStep
        // Visited routes keep client state; remount when the saved location changes.
        key={`${area?.slug}-${profile.radiusKm}-${typeof back === "string" ? back : ""}`}
        initialAreaSlug={area?.slug ?? null}
        initialRadius={isRadius(profile.radiusKm) ? profile.radiusKm : DEFAULT_RADIUS}
        from={isOrigin(from) ? from : "discover"}
        back={typeof back === "string" ? back : undefined}
        saveLabel="Save"
      />
    </OnboardingShell>
  );
}
