import { Suspense } from "react";
import { MobileHeader, PageContainer } from "@/components/app/AppShell";
import { EMPTY_DRAFT, type Draft } from "@/lib/activity";
import { AREAS } from "@/lib/locations/bengaluru";
import { loadAfterActivity } from "@/server/chat";
import { loadInterests, photoUrl, requireOnboarded } from "@/server/profile";
import { StepOne } from "./StepOne";

/** S12 Create activity, step 1 of 2: what. `?from={id}` re-hosts a past activity (ST-115). */
export default function NewActivityPage({ searchParams }: PageProps<"/activities/new">) {
  return (
    <>
      <MobileHeader title="New activity" back={{ href: "/activities", label: "Back to Activities" }} />
      <PageContainer>
        <Suspense fallback={<div aria-busy="true" className="h-[480px] animate-pulse rounded-card bg-hover" />}>
          <NewActivity searchParams={searchParams} />
        </Suspense>
      </PageContainer>
    </>
  );
}

async function NewActivity({ searchParams }: Pick<PageProps<"/activities/new">, "searchParams">) {
  const { from } = await searchParams;
  const { supabase, profile } = await requireOnboarded();
  const catalogue = await loadInterests(supabase);
  const source = typeof from === "string" ? await loadAfterActivity(supabase, from, catalogue) : null;
  const prefill: Draft | undefined = source
    ? {
        ...EMPTY_DRAFT,
        interestId: source.interest.id,
        title: source.title,
        details: source.description ?? "",
        areaSlug: AREAS.find((x) => x.name === source.areaName)?.slug ?? null,
        address: source.address ?? "",
        limit: source.limit,
        visibility: source.visibility,
      }
    : undefined;
  return (
    <StepOne
      catalogue={catalogue}
      mine={profile.interestIds}
      host={{ id: profile.id, firstName: profile.firstName ?? "", photoUrl: photoUrl(profile.photoPath) }}
      prefill={prefill}
    />
  );
}
