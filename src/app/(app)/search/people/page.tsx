import Link from "next/link";
import { Suspense } from "react";
import { Plus, Search } from "lucide-react";
import { MobileHeader, PageContainer } from "@/components/app/AppShell";
import { PersonCard } from "@/components/cards/PersonCard";
import { buttonClasses } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Grid3 } from "@/components/ui/Grid";
import { InterestFilter } from "@/components/ui/InterestFilter";
import { LocationSelector } from "@/components/ui/LocationSelector";
import { cleanQuery, mutualLabel, peopleCountLine, pickInterest, searchHref } from "@/lib/search";
import { loadInterests, requireOnboarded } from "@/server/profile";
import { searchPeople } from "@/server/search";
import { SearchBar } from "../SearchBar";
import { SearchHeading, SearchSkeleton } from "../SearchHeading";
import { ConnectControl } from "./ConnectControl";

const PATH = "/search/people";

/** S18 Search people. */
export default function SearchPeoplePage({ searchParams }: PageProps<"/search/people">) {
  return (
    <>
      <MobileHeader title="Search" />
      <PageContainer>
        <SearchHeading />
        <Suspense fallback={<SearchSkeleton />}>
          <People searchParams={searchParams} />
        </Suspense>
      </PageContainer>
    </>
  );
}

async function People({ searchParams }: Pick<PageProps<"/search/people">, "searchParams">) {
  const params = await searchParams;
  const { supabase, profile } = await requireOnboarded();
  const catalogue = await loadInterests(supabase);
  // Q-52: chips are the viewer's own interests.
  const mine = catalogue.filter((i) => profile.interestIds.includes(i.id));
  const q = cleanQuery(params.q);
  const interest = pickInterest(params.interest, mine);
  const people = await searchPeople(supabase, { q, interestId: interest?.id ?? null }, profile.interestIds, catalogue);

  return (
    <>
      <SearchBar mode="people" />

      {/* Q-07: one filter row — location/distance (saved radius, Q-50) + interest filter (Q-52). */}
      <div className="-mx-4 mt-5 flex gap-2.5 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:flex-wrap md:overflow-visible md:px-0">
        <LocationSelector
          areaName={profile.areaName ?? ""}
          city={profile.city}
          radiusKm={profile.radiusKm}
          href="/location?from=search"
        />
        <InterestFilter
          title="Show people who like"
          options={[{ slug: null, name: "All my interests" }, ...mine].map((i) => ({
            key: i.slug ?? "all",
            label: i.name,
            href: searchHref(PATH, params, { interest: i.slug }),
            active: i.slug === (interest?.slug ?? null),
          }))}
        />
      </div>

      <p className="mt-5 text-[15px] leading-[22px] text-slate" data-testid="count-line" role="status">
        {peopleCountLine(people.length, interest?.name ?? null, profile.radiusKm)}
      </p>

      <div className="mt-3.5">
        {people.length ? (
          <Grid3 label="People">
            {people.map((p) => (
              <li key={p.id}>
                <PersonCard
                  person={{ ...p, interests: p.interests.slice(0, 3) }}
                  href={`/people/${p.id}?from=search`}
                  label={mutualLabel(p.relationship === "connected", p.mutualCount)}
                  action={<ConnectControl key={p.relationship} personId={p.id} name={p.firstName} initial={p.relationship} />}
                />
              </li>
            ))}
          </Grid3>
        ) : (
          <EmptyState
            icon={<Search size={28} strokeWidth={1.8} aria-hidden="true" />}
            title="No one matches yet"
            help="Try a wider distance or another interest. You can also create an activity and let people find you."
            action={
              <Link href="/activities/new" className={buttonClasses("primary")}>
                <Plus size={20} strokeWidth={1.8} aria-hidden="true" />
                Create an activity
              </Link>
            }
          />
        )}
      </div>
    </>
  );
}
