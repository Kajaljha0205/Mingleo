import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { CalendarDays, MapPin, Plus } from "lucide-react";
import { MobileHeader, PageContainer } from "@/components/app/AppShell";
import { ActivityCover } from "@/components/cards/ActivityCard";
import { Avatar } from "@/components/ui/Avatar";
import { BackLink } from "@/components/ui/BackLink";
import { CapacityBar } from "@/components/ui/CapacityBar";
import { StatusPill } from "@/components/ui/StatusPill";
import { spotsLeftLabel, visibilityLine } from "@/lib/activity";
import { distanceLabel, plural } from "@/lib/format";
import { originFrom } from "@/lib/origins";
import { dateTimeRange, startsIn } from "@/lib/time";
import { loadActivity, type ActivityDetails } from "@/server/activities";
import { loadInterests, requireOnboarded } from "@/server/profile";
import { JoinControl } from "./JoinControl";

export default function ActivityPage({ params, searchParams }: PageProps<"/activities/[id]">) {
  return (
    <Suspense fallback={<DetailsSkeleton />}>
      <Activity params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Activity({ params, searchParams }: PageProps<"/activities/[id]">) {
  const [{ id }, { from }] = await Promise.all([params, searchParams]);
  const origin = originFrom(from, "activities");
  const { supabase, userId } = await requireOnboarded();
  const catalogue = await loadInterests(supabase);
  // Unknown, hidden by visibility, blocked or cancelled-and-uninvolved all 404 alike.
  const a = await loadActivity(supabase, id, catalogue);
  if (!a) notFound();

  const left = Math.max(0, a.limit - a.going);
  const insider = a.viewerState === "host" || a.viewerState === "accepted";

  return (
    <>
      <MobileHeader title={a.title} back={{ href: origin.href, label: `Back to ${origin.label}` }} />
      <PageContainer>
        <BackLink href={origin.href} label={`Back to ${origin.label}`} />
        <div className="grid gap-6 md:mt-6 md:grid-cols-2 md:gap-7 lg:grid-cols-[1.55fr_1fr] lg:gap-10">
          <div className="min-w-0">
            <ActivityCover
              slug={a.interest.slug}
              interestName={a.interest.name}
              className="h-[260px] rounded-media"
              sizes="(min-width: 1024px) 720px, (min-width: 768px) 50vw, 100vw"
              priority
            />
            <h1 className="mt-5 font-display text-[30px] leading-9 font-extrabold tracking-[-0.02em] break-words lg:text-[40px] lg:leading-[48px]">
              {a.title}
            </h1>
            <p className="mt-1.5 text-[16px] text-slate">{visibilityLine(a.visibility)}</p>
          </div>

          <aside
            aria-label="When, where and joining"
            className="min-w-0 self-start rounded-card border border-border bg-white p-5 shadow-onboarding md:row-span-2 md:sticky md:top-[108px] lg:p-6"
          >
            {a.phase === "cancelled" && (
              <div role="status" className="mb-5 rounded-input bg-danger-tint px-4 py-3 text-danger-tint-text">
                <p className="text-[15px] font-bold">Cancelled by host</p>
                {a.cancelNote && <p className="mt-1 text-[14px]">“{a.cancelNote}”</p>}
              </div>
            )}
            <Row icon={<CalendarDays size={22} strokeWidth={1.8} aria-hidden="true" />}>
              <p className="font-bold">{dateTimeRange(new Date(a.startsAt), a.endsAt ? new Date(a.endsAt) : null)}</p>
              <p className="text-slate">{phaseLine(a)}</p>
            </Row>
            <Row icon={<MapPin size={22} strokeWidth={1.8} aria-hidden="true" />}>
              <p className="font-bold">
                {a.areaName} · {distanceLabel(a.distanceKm)}
              </p>
              {insider ? (
                a.address && <p className="text-slate" data-testid="exact-address">{a.address}</p>
              ) : (
                <p className="text-slate">Exact location shared once you&apos;re accepted</p>
              )}
            </Row>
            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between gap-3 text-[16px]">
                <p className="font-bold">
                  {a.going} of {a.limit} going
                </p>
                {left === 0 ? (
                  <StatusPill variant="full">Full</StatusPill>
                ) : (
                  <p className="font-semibold text-sage-text">{spotsLeftLabel(left)}</p>
                )}
              </div>
              <CapacityBar going={a.going} limit={a.limit} />
            </div>
            <JoinControl
              // Remount when the server state changes (after an action or elsewhere).
              key={`${a.viewerState}:${a.going}:${a.phase}`}
              activityId={a.id}
              hostName={a.host.firstName}
              initial={a.viewerState}
              full={left === 0}
              phase={a.phase}
            />
          </aside>

          <div className="min-w-0">
            <HostCard a={a} viewerIsHost={a.viewerState === "host"} />
            {a.description && (
              <>
                <h2 className="mt-7 text-[13px] font-bold tracking-[0.08em] text-slate uppercase">About</h2>
                <p className="mt-2 text-[17px] leading-[27px] whitespace-pre-line">{a.description}</p>
              </>
            )}
            <h2 className="mt-7 text-[13px] font-bold tracking-[0.08em] text-slate uppercase">Who&apos;s going</h2>
            <ul className="mt-3 grid grid-cols-2 gap-3" aria-label="Who's going">
              {a.participants.map((p) => (
                <li key={p.id} className="flex min-w-0 items-center gap-3 rounded-card border border-border bg-white p-3">
                  <Avatar id={p.id} name={p.firstName} photoUrl={p.photoUrl} size={48} />
                  <span className="min-w-0 flex-1 truncate text-[16px] font-semibold">
                    {p.id === userId ? "You" : p.firstName}
                  </span>
                  {p.role === "host" && <StatusPill variant="host">Host</StatusPill>}
                </li>
              ))}
              {left > 0 && a.phase !== "cancelled" && (
                <li className="flex min-w-0 items-center gap-3 rounded-card border border-dashed border-blue-600/50 p-3 text-blue-700">
                  <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-full border border-dashed border-blue-600/50">
                    <Plus size={20} strokeWidth={1.8} aria-hidden="true" />
                  </span>
                  <span className="truncate text-[16px] font-semibold">
                    {left} {left === 1 ? "spot" : "spots"} open
                  </span>
                </li>
              )}
            </ul>
          </div>
        </div>
      </PageContainer>
    </>
  );
}

function phaseLine(a: ActivityDetails): string {
  if (a.phase === "started") return "Happening now";
  if (a.phase === "completed") return "Finished";
  return startsIn(new Date(a.startsAt), new Date());
}

function Row({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="flex gap-3.5 text-[16px] leading-6 [&+&]:mt-4">
      <span className="mt-0.5 shrink-0 text-blue-600">{icon}</span>
      <div className="min-w-0 break-words">{children}</div>
    </div>
  );
}

function HostCard({ a, viewerIsHost }: { a: ActivityDetails; viewerIsHost: boolean }) {
  const h = a.host;
  const facts = viewerIsHost
    ? [plural(h.hostedCount, "activity hosted", "activities hosted")]
    : [
        h.connected ? "Connected" : "Not connected",
        plural(h.sharedCount, "shared interest", "shared interests"),
        `hosted ${plural(h.hostedCount, "activity", "activities")}`,
      ];
  return (
    <div className="flex items-center gap-4 rounded-card border border-border bg-white p-4" data-testid="host-card">
      <Avatar id={h.id} name={h.firstName} photoUrl={h.photoUrl} size={48} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[17px] font-bold">Hosted by {viewerIsHost ? "you" : h.firstName}</p>
        <p className="text-[15px] text-slate">{facts.join(" · ")}</p>
      </div>
      {!viewerIsHost && (
        <Link
          href={`/people/${h.id}?from=activities`}
          className="inline-flex min-h-11 shrink-0 items-center rounded-input px-1 text-[16px] font-semibold text-blue-700 hover:underline focus-visible:outline-2 focus-visible:outline-blue-600"
        >
          View profile
        </Link>
      )}
    </div>
  );
}

function DetailsSkeleton() {
  return (
    <PageContainer>
      <div aria-busy="true" className="grid gap-6 md:mt-12 md:grid-cols-2 lg:grid-cols-[1.55fr_1fr]">
        <div className="h-[260px] animate-pulse rounded-media bg-hover" />
        <div className="h-[320px] animate-pulse rounded-card bg-hover" />
      </div>
    </PageContainer>
  );
}
