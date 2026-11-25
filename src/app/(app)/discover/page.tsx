import { Suspense } from "react";
import { MobileHeader, PageContainer } from "@/components/app/AppShell";
import { LocationSelector } from "@/components/ui/LocationSelector";
import { loadCandidates } from "@/server/discover";
import { loadInterests, requireOnboarded } from "@/server/profile";
import { DiscoverDeck } from "./DiscoverDeck";
import { InterestFilter } from "@/components/ui/InterestFilter";

export default function DiscoverPage({ searchParams }: PageProps<"/discover">) {
  return (
    <>
      <MobileHeader title="Discover" />
      <PageContainer>
        <Suspense fallback={<DiscoverSkeleton />}>
          <Discover searchParams={searchParams} />
        </Suspense>
      </PageContainer>
    </>
  );
}

async function Discover({ searchParams }: Pick<PageProps<"/discover">, "searchParams">) {
  const { interest } = await searchParams;
  const { supabase, profile } = await requireOnboarded();
  const catalogue = await loadInterests(supabase);
  const mine = catalogue.filter((i) => profile.interestIds.includes(i.id));
  const selected = mine.find((i) => i.slug === interest) ?? null;
  const candidates = await loadCandidates(supabase, profile.interestIds, catalogue, selected?.id ?? null);

  return (
    <>
      <div className="flex flex-col gap-4 md:flex-row md:flex-wrap md:items-end md:justify-between">
        <div className="sr-only md:not-sr-only">
          <h1 className="font-display text-[30px] leading-9 font-extrabold tracking-[-0.02em] lg:text-[36px] lg:leading-[42px]">
            Discover people
          </h1>
          <p className="mt-1 text-[16px] leading-6 text-slate">
            People nearby who share your interests. Connecting is always mutual.
          </p>
        </div>
        <div className="-mx-4 flex gap-2.5 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:flex-wrap md:overflow-visible md:px-0">
          <LocationSelector
            areaName={profile.areaName ?? ""}
            radiusKm={profile.radiusKm}
            href="/location?from=discover"
          />
          <InterestFilter
            title="Show people who like"
            options={[{ slug: null, name: "All my interests" }, ...mine].map((i) => ({
              key: i.slug ?? "all",
              label: i.name,
              href: i.slug ? `/discover?interest=${i.slug}` : "/discover",
              active: i.slug === (selected?.slug ?? null),
            }))}
          />
        </div>
      </div>
      <DiscoverDeck
        // New filter or round (Start over) → fresh queue; otherwise keep the client queue mid-swipe.
        key={`${profile.discoverRound}:${selected?.slug ?? "all"}`}
        candidates={candidates}
      />
    </>
  );
}

function DiscoverSkeleton() {
  return (
    <div aria-busy="true" className="mt-6 grid gap-[22px] md:grid-cols-2 lg:grid-cols-[1.3fr_1fr]">
      <div className="mx-auto h-[560px] w-full max-w-[480px] animate-pulse rounded-media bg-hover" />
      <div className="hidden h-[320px] animate-pulse rounded-card bg-hover md:block" />
    </div>
  );
}
