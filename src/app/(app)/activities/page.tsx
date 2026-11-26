import { Suspense } from "react";
import { MobileHeader, PageContainer } from "@/components/app/AppShell";
import { loadFeed } from "@/server/activities";
import { loadInterests, requireOnboarded } from "@/server/profile";
import { eyebrowDate, greeting } from "@/lib/time";
import { ActivitiesView } from "./ActivitiesView";

export default function ActivitiesPage() {
  return (
    <>
      <MobileHeader title="Activities" />
      <PageContainer>
        <Suspense fallback={<ActivitiesSkeleton />}>
          <Activities />
        </Suspense>
      </PageContainer>
    </>
  );
}

async function Activities() {
  const { supabase, userId, profile } = await requireOnboarded();
  const catalogue = await loadInterests(supabase);
  const feed = (await loadFeed(supabase, catalogue)).filter((a) => profile.interestIds.includes(a.interest.id));
  const now = new Date();

  // Chips: All + each interest present in the current results (catalogue order).
  const present = catalogue.filter((i) => feed.some((a) => a.interest.id === i.id));

  return (
    <ActivitiesView
      feed={feed}
      present={present}
      userId={userId}
      firstName={profile.firstName}
      eyebrow={eyebrowDate(now)}
      greetingText={greeting(now)}
      nowMs={now.getTime()}
      areaName={profile.areaName ?? ""}
      city={profile.city}
      radiusKm={profile.radiusKm}
    />
  );
}

function ActivitiesSkeleton() {
  return (
    <div aria-busy="true">
      <div className="h-[104px] w-full max-w-[420px] animate-pulse rounded-card bg-hover" />
      <div className="mt-8 grid gap-3.5 md:grid-cols-2 md:gap-[18px] lg:grid-cols-3 lg:gap-[22px]">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-[300px] animate-pulse rounded-card bg-hover" />
        ))}
      </div>
    </div>
  );
}
