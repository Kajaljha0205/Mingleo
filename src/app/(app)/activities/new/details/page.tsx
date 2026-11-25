import { Suspense } from "react";
import { MobileHeader, PageContainer } from "@/components/app/AppShell";
import { loadInterests, photoUrl, requireOnboarded } from "@/server/profile";
import { StepTwo } from "../StepTwo";

/** S13 Create activity, step 2 of 2: where, when, who. */
export default function NewActivityDetailsPage() {
  return (
    <>
      <MobileHeader title="New activity" back={{ href: "/activities/new", label: "Back to step 1" }} />
      <PageContainer>
        <Suspense fallback={<div aria-busy="true" className="h-[640px] animate-pulse rounded-card bg-hover" />}>
          <Details />
        </Suspense>
      </PageContainer>
    </>
  );
}

async function Details() {
  const { supabase, profile } = await requireOnboarded();
  const catalogue = await loadInterests(supabase);
  return (
    <StepTwo
      catalogue={catalogue}
      host={{ id: profile.id, firstName: profile.firstName ?? "", photoUrl: photoUrl(profile.photoPath) }}
    />
  );
}
