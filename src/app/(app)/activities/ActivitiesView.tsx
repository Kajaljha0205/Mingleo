"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { type ReactNode } from "react";
import { Plus } from "lucide-react";
import { ActivityCard } from "@/components/cards/ActivityCard";
import { buttonClasses } from "@/components/ui/Button";
import { FilterChips } from "@/components/ui/FilterChips";
import { Grid3 } from "@/components/ui/Grid";
import { LocationSelector } from "@/components/ui/LocationSelector";
import { activityHref, showsJoinAction } from "@/lib/activity";
import type { ActivitySummary } from "@/server/activities";
import { CardJoinButton } from "./CardJoinButton";

const WEEK_MS = 7 * 86_400_000;

type Interest = { id: number; slug: string; name: string };

type Props = {
  feed: ActivitySummary[];
  /** Catalogue entries that appear in the feed (catalogue order). */
  present: Interest[];
  userId: string;
  firstName: string | null;
  eyebrow: string;
  greetingText: string;
  nowMs: number;
  areaName: string;
  city: string | null;
  radiusKm: number;
};

/**
 * S10 body. The feed is loaded once on the server; interest chips filter it here, instantly,
 * and keep ?interest= in the URL (history.pushState is picked up by useSearchParams).
 */
export function ActivitiesView({
  feed,
  present,
  userId,
  firstName,
  eyebrow,
  greetingText,
  nowMs,
  areaName,
  city,
  radiusKm,
}: Props) {
  const params = useSearchParams();
  const interest = params.get("interest");
  const selected = present.find((i) => i.slug === interest) ?? null;
  const shown = selected ? feed.filter((a) => a.interest.id === selected.id) : feed;
  const people = shown.filter((a) => a.section === "people");
  const nearby = shown.filter((a) => a.section === "nearby");
  // Q-09: the feed shows everything upcoming; the count line covers the next 7 days.
  const thisWeek = shown.filter((a) => Date.parse(a.startsAt) - nowMs < WEEK_MS).length;
  const noun = thisWeek === 1 ? "activity" : "activities";

  function choose(e: React.MouseEvent<HTMLAnchorElement>, href: string) {
    // Let new-tab / modified clicks behave normally.
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    window.history.pushState(null, "", href);
  }

  return (
    <>
      <div className="flex flex-col gap-4 md:flex-row md:flex-wrap md:items-end md:justify-between">
        <div className="min-w-0">
          <p className="text-[13px] font-bold tracking-[0.08em] text-slate uppercase">{eyebrow}</p>
          <h1 className="mt-1 font-display text-[30px] leading-9 font-extrabold tracking-[-0.02em] lg:text-[40px] lg:leading-[48px]">
            {greetingText}, {firstName}
          </h1>
          <p className="mt-1 text-[16px] leading-6 text-slate" data-testid="count-line">
            {thisWeek} {selected ? `${selected.name} ` : ""}
            {noun} near you this week
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <LocationSelector areaName={areaName} city={city} radiusKm={radiusKm} href="/location?from=activities" />
          <Link href="/activities/new" className={`${buttonClasses("primary")} w-auto! shrink-0`}>
            <Plus size={20} strokeWidth={1.8} aria-hidden="true" />
            Create activity
          </Link>
        </div>
      </div>

      <FilterChips
        label="Filter by interest"
        className="mt-6"
        onSelect={choose}
        items={[{ slug: null, name: "All" }, ...present].map((o) => ({
          key: o.slug ?? "all",
          label: o.name,
          href: o.slug ? `/activities?interest=${o.slug}` : "/activities",
          active: o.slug === (selected?.slug ?? null),
        }))}
      />

      <section aria-labelledby="people-heading" className="mt-7">
        <div className="mb-3.5 flex items-baseline justify-between gap-4">
          <h2 id="people-heading" className="font-display text-[22px] leading-7 font-bold">
            From your people
          </h2>
          {/* Q-18: S19 pre-filtered to connections' activities. */}
          <Link
            href="/search/activities?from=people"
            className="shrink-0 rounded-input text-[16px] font-semibold text-blue-700 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-blue-600"
          >
            See all
          </Link>
        </div>
        {people.length ? (
          <Cards activities={people} userId={userId} label="From your people" />
        ) : (
          <SectionEmpty>
            None of your connections have {selected ? `a ${selected.name}` : "an"} activity this week.
          </SectionEmpty>
        )}
      </section>

      <section aria-labelledby="nearby-heading" className="mt-9">
        <div className="mb-3.5 flex flex-col gap-1 md:flex-row md:items-baseline md:justify-between md:gap-4">
          <h2 id="nearby-heading" className="font-display text-[22px] leading-7 font-bold">
            Nearby activities
          </h2>
          <p className="text-[15px] leading-[22px] text-slate">
            From people you&apos;re not connected with yet. Hosts approve each request.
          </p>
        </div>
        {nearby.length ? (
          <Cards activities={nearby} userId={userId} label="Nearby activities" />
        ) : (
          <SectionEmpty>
            No {selected ? `${selected.name} ` : ""}activities nearby right now.{" "}
            <Link href="/activities/new" className="font-semibold text-blue-700 underline underline-offset-4">
              Create one
            </Link>{" "}
            and people with that interest will find it.
          </SectionEmpty>
        )}
      </section>
    </>
  );
}

function Cards({ activities, userId, label }: { activities: ActivitySummary[]; userId: string; label: string }) {
  return (
    <Grid3 label={label}>
      {activities.map((a) => (
        <li key={a.id}>
          <ActivityCard
            activity={a}
            href={activityHref(a, userId)}
            action={
              showsJoinAction(a) && (
                <CardJoinButton
                  activityId={a.id}
                  title={a.title}
                  hostName={a.host.firstName}
                  initial={a.viewerState}
                />
              )
            }
          />
        </li>
      ))}
    </Grid3>
  );
}

function SectionEmpty({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-card border border-border bg-white px-5 py-6 text-[15px] leading-[22px] text-slate">{children}</p>
  );
}
