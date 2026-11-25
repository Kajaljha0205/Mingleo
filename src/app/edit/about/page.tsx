import { Suspense } from "react";
import { OnboardingShell, StepHeading, StepSkeleton } from "@/components/onboarding/OnboardingShell";
import { isoToBirthdayInput } from "@/lib/validation";
import { requireOnboarded } from "@/server/profile";
import { AboutForm } from "../../onboarding/about/AboutForm";

/** S03 in edit mode (ST-174): no progress, Save returns to S21. */
export default function EditAboutPage() {
  return (
    <OnboardingShell edit={{ backHref: "/profile", backLabel: "Back to Profile" }}>
      <StepHeading title="A little about you" help="This is what people see before they connect or accept you into an activity." />
      <Suspense fallback={<StepSkeleton />}>
        <About />
      </Suspense>
    </OnboardingShell>
  );
}

async function About() {
  const { profile } = await requireOnboarded();
  const initial = {
    firstName: profile.firstName ?? "",
    birthday: isoToBirthdayInput(profile.birthDate),
    showAge: profile.showAge,
    bio: profile.bio ?? "",
  };
  return <AboutForm key={JSON.stringify(initial)} from="profile" saveLabel="Save" initial={initial} />;
}
