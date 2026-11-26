import Link from "next/link";
import { Suspense } from "react";
import { CalendarDays, Plus, Search, X } from "lucide-react";
import { MobileHeader, PageContainer } from "@/components/app/AppShell";
import { ActivityCard } from "@/components/cards/ActivityCard";
import { buttonClasses } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterChips } from "@/components/ui/FilterChips";
import { Grid3 } from "@/components/ui/Grid";
import { InterestFilter } from "@/components/ui/InterestFilter";
import { LocationSelector } from "@/components/ui/LocationSelector";
import { activityHref, showsJoinAction } from "@/lib/activity";
import { activitiesCountLine, cleanQuery, dayChips, dayLabel, pickDate, pickInterest, searchHref } from "@/lib/search";
import { dateKey, dayChip } from "@/lib/time";
import { searchBackQuery } from "@/lib/origins";
import { loadInterests, requireOnboarded } from "@/server/profile";
import { searchActivities } from "@/server/search";
import { CardJoinButton } from "../../activities/CardJoinButton";
import { SearchBar } from "../SearchBar";
import { SearchHeading, SearchSkeleton } from "../SearchHeading";
import { DatePickerChip } from "./DatePickerChip";

const PATH = "/search/activities";

/** S19 Search activities. */
export default function SearchActivitiesPage({ searchParams }: PageProps<"/search/activities">) {
  return (
    <>
      <MobileHeader title="Search" />
      <PageContainer>
        <SearchHeading />
        <Suspense fallback={<SearchSkeleton />}>
          <Activities searchParams={searchParams} />
        </Suspense>
      </PageContainer>
    </>
  );
}

function locationHref(params: Record<string, string | string[] | undefined>) {
  const back = searchBackQuery(params);
  return back ? `/location?from=search-activities&back=${encodeURIComponent(back)}` : "/location?from=search-activities";
}

async function Activities({ searchParams }: Pick<PageProps<"/search/activities">, "searchParams">) {
  const params = await searchParams;
  const { supabase, userId, profile } = await requireOnboarded();
  const catalogue = await loadInterests(supabase);
  // Q-52: chips are the viewer's own interests.
  const mine = catalogue.filter((i) => profile.interestIds.includes(i.id));
  const now = new Date();
  const q = cleanQuery(params.q);
  const interest = pickInterest(params.interest, mine);
  const date = pickDate(params.date, now);
  // Q-18: S10 "See all" opens this pre-filtered to connections' activities.
  const fromPeople = params.from === "people";
  const activities = await searchActivities(supabase, { q, interestId: interest?.id ?? null, date, fromPeople }, catalogue);

  const days = dayChips(now);
  const otherDate = date !== null && !days.includes(date);
  const calendarIcon = <CalendarDays size={18} strokeWidth={1.8} aria-hidden="true" />;

  return (
    <>
      <SearchBar mode="activities" />

      {/* Q-07: one filter row — location/distance + interest filter; dates below. */}
      <div className="-mx-4 mt-5 flex gap-2.5 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:flex-wrap md:overflow-visible md:px-0">
        <LocationSelector areaName={profile.areaName ?? ""} radiusKm={profile.radiusKm} href={locationHref(params)} />
        <InterestFilter
          title="Show activities for"
          options={[{ slug: null, name: "All my interests" }, ...mine].map((i) => ({
            key: i.slug ?? "all",
            label: i.name,
            href: searchHref(PATH, params, { interest: i.slug }),
            active: i.slug === (interest?.slug ?? null),
          }))}
        />
        {fromPeople && (
          <Link
            href={searchHref(PATH, params, { from: null })}
            scroll={false}
            aria-label="Remove filter: From your people"
            className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-blue-600 bg-light-blue px-4 text-[15px] font-semibold text-blue-700 hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            From your people
            <X size={16} strokeWidth={1.8} aria-hidden="true" />
          </Link>
        )}
      </div>

      <FilterChips
        label="Date"
        className="mt-3"
        items={[
          { key: "any", label: "Any day", href: searchHref(PATH, params, { date: null }), active: date === null, icon: calendarIcon },
          ...days.map((d) => ({
            key: d,
            label: dayChip(d).weekday,
            href: searchHref(PATH, params, { date: d }),
            active: d === date,
            icon: calendarIcon,
          })),
        ]}
        trailing={
          <DatePickerChip
            value={otherDate ? date : null}
            min={dateKey(now)}
            label={otherDate ? dayLabel(date) : "Pick a date"}
            baseHref={searchHref(PATH, params, { date: null })}
          />
        }
      />

      <p className="mt-5 text-[15px] leading-[22px] text-slate" data-testid="count-line" role="status">
        {activitiesCountLine(activities.length, date, profile.radiusKm)}
      </p>

      <div className="mt-3.5">
        {activities.length ? (
          <Grid3 label="Activities">
            {activities.map((a) => {
              const full = a.going >= a.limit;
              const href = activityHref(a, userId);
              return (
                <li key={a.id}>
                  <ActivityCard
                    activity={a}
                    href={a.host.id === userId ? href : `${href}?from=search-activities`}
                    muted={full}
                    fullLabel="Full · requests closed"
                    action={
                      // Q-54: same inline action as S10; full ones get none.
                      showsJoinAction(a) && (
                        <CardJoinButton activityId={a.id} title={a.title} hostName={a.host.firstName} initial={a.viewerState} />
                      )
                    }
                  />
                </li>
              );
            })}
          </Grid3>
        ) : (
          <EmptyState
            icon={<Search size={28} strokeWidth={1.8} aria-hidden="true" />}
            title="Nothing on that day yet"
            help="Be the first. People nearby who share the interest will see it."
            action={
              <Link href="/activities/new" className={buttonClasses("primary")}>
                <Plus size={20} strokeWidth={1.8} aria-hidden="true" />
                Create activity
              </Link>
            }
          />
        )}
      </div>
    </>
  );
}
