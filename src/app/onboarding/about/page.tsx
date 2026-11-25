import { Suspense } from "react";
import {
  OnboardingShell,
  StepHeading,
  StepSkeleton,
} from "@/components/onboarding/OnboardingShell";
import { stepNumber } from "@/lib/onboarding";
import { isoToBirthdayInput } from "@/lib/validation";
import { requireStep } from "@/server/profile";
import { AboutForm } from "./AboutForm";

export default function AboutPage({ searchParams }: PageProps<"/onboarding/about">) {
  return (
    <OnboardingShell step={stepNumber("about")}>
      <StepHeading
        title="A little about you"
        help="This is what people see before they connect or accept you into an activity."
      />
      <Suspense fallback={<StepSkeleton />}>
        <AboutLoader searchParams={searchParams} />
      </Suspense>
    </OnboardingShell>
  );
}

async function AboutLoader({ searchParams }: Pick<PageProps<"/onboarding/about">, "searchParams">) {
  const { from } = await searchParams;
  const { profile } = await requireStep("about");
  const initial = {
    firstName: profile.firstName ?? "",
    birthday: isoToBirthdayInput(profile.birthDate),
    showAge: profile.showAge,
    bio: profile.bio ?? "",
  };
  return (
    <AboutForm
      key={JSON.stringify(initial)}
      from={from === "review" ? "review" : undefined}
      initial={initial}
    />
  );
}
