import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { CalendarDays, MapPin } from "lucide-react";
import { MobileHeader, PageContainer } from "@/components/app/AppShell";
import { ActivityCover } from "@/components/cards/ActivityCard";
import { Avatar } from "@/components/ui/Avatar";
import { BackLink } from "@/components/ui/BackLink";
import { CapacityBar } from "@/components/ui/CapacityBar";
import { StatusPill } from "@/components/ui/StatusPill";
import { spotsLeftLabel, visibilityPill } from "@/lib/activity";
import { dateTimeRange } from "@/lib/time";
import { loadManage } from "@/server/activities";
import { loadInterests, requireOnboarded } from "@/server/profile";
import { AutoRedirectWhenEnded } from "../AutoRedirectWhenEnded";
import { HostActions, RequestsPanel } from "./ManagePanel";

/** S14 Host: manage activity (host only — everyone else gets the same 404). */
export default function ManagePage({ params }: PageProps<"/activities/[id]/manage">) {
  return (
    <Suspense fallback={<ManageSkeleton />}>
      <Manage params={params} />
    </Suspense>
  );
}

async function Manage({ params }: Pick<PageProps<"/activities/[id]/manage">, "params">) {
  const { id } = await params;
  const { supabase } = await requireOnboarded();
  const catalogue = await loadInterests(supabase);
  const a = await loadManage(supabase, id, catalogue);
  if (!a) notFound();
  if (a.phase === "completed") redirect(`/activities/${a.id}/after`);

  const left = Math.max(0, a.limit - a.going);
  const cancelled = a.phase === "cancelled";
  const editable = a.phase === "open" || a.phase === "started";
  const others = a.participants.filter((p) => p.role !== "host");

  return (
    <>
      {editable && <AutoRedirectWhenEnded startsAt={a.startsAt} endsAt={a.endsAt} to={`/activities/${a.id}/after`} />}
      <MobileHeader title={a.title} back={{ href: "/activities", label: "Back to Activities" }} />
      <PageContainer>
        <BackLink href="/activities" label="Back to Activities" />
        <div className="grid gap-7 md:mt-6 md:grid-cols-2 lg:grid-cols-[1.3fr_1fr] lg:gap-12">
          <section aria-label="Summary" className="min-w-0 self-start overflow-hidden rounded-card border border-border bg-white">
            <ActivityCover
              slug={a.interest.slug}
              interestName={a.interest.name}
              className={`h-[200px] lg:h-[260px] ${cancelled ? "grayscale" : ""}`}
              sizes="(min-width: 1024px) 720px, (min-width: 768px) 50vw, 100vw"
              priority
              chips={
                <>
                  {cancelled ? (
                    <StatusPill variant="cancelled">Cancelled</StatusPill>
                  ) : (
                    <StatusPill variant="positive">{a.phase === "open" ? "Open" : "Happening now"}</StatusPill>
                  )}
                  <StatusPill variant="host">{visibilityPill(a.visibility)}</StatusPill>
                </>
              }
            />
            <div className="p-5 lg:p-7">
              <h1 className="font-display text-[28px] leading-[34px] font-extrabold tracking-[-0.02em] break-words lg:text-[40px] lg:leading-[48px]">
                {a.title}
              </h1>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-[16px] text-slate">
                <span className="inline-flex items-center gap-2">
                  <CalendarDays size={20} strokeWidth={1.8} aria-hidden="true" />
                  {dateTimeRange(new Date(a.startsAt), a.endsAt ? new Date(a.endsAt) : null)}
                </span>
                <span className="inline-flex min-w-0 items-center gap-2">
                  <MapPin size={20} strokeWidth={1.8} aria-hidden="true" className="shrink-0" />
                  <span className="min-w-0 break-words">
                    {a.areaName}
                    {a.address && ` · ${a.address}`}
                  </span>
                </span>
              </div>
              <div className="mt-5">
                <div className="mb-2 flex items-center justify-between gap-3 text-[16px]">
                  <p className="font-bold">
                    {a.going} of {a.limit} going
                  </p>
                  <p className="text-slate">{left === 0 ? "Full" : spotsLeftLabel(left)}</p>
                </div>
                <CapacityBar going={a.going} limit={a.limit} />
              </div>
              {cancelled ? (
                <div role="status" className="mt-6 rounded-input bg-danger-tint px-4 py-3 text-danger-tint-text">
                  <p className="text-[15px] font-bold">You cancelled this activity. Everyone involved was told.</p>
                  {a.cancelNote && <p className="mt-1 text-[14px]">Your note: “{a.cancelNote}”</p>}
                </div>
              ) : (
                <HostActions
                  activityId={a.id}
                  title={a.title}
                  editable={editable}
                  participantNames={others.map((p) => p.firstName)}
                  waiting={a.requests.length}
                />
              )}
            </div>
          </section>

          <div className="min-w-0">
            <RequestsPanel
              // Reset optimistic state whenever the server list changes.
              key={a.requests.map((r) => r.participationId).join() + a.going}
              requests={a.requests}
              full={left === 0}
              open={!cancelled}
            />

            <h2 className="mt-8 font-display text-[22px] leading-7 font-bold">
              Going <span className="text-slate">· {a.going}</span>
            </h2>
            <ul className="mt-3 rounded-card border border-border bg-white px-4" aria-label="Going">
              {a.participants.map((p) => (
                <li key={p.id} className="flex items-center gap-3 border-b border-border py-3 last:border-0">
                  <Avatar id={p.id} name={p.firstName} photoUrl={p.photoUrl} size={48} />
                  <span className="min-w-0 flex-1 truncate text-[16px] font-semibold">
                    {p.role === "host" ? "You" : p.firstName}
                  </span>
                  {p.role === "host" ? (
                    <StatusPill variant="host">Host</StatusPill>
                  ) : p.connected ? (
                    <StatusPill variant="positive">Connected</StatusPill>
                  ) : (
                    <StatusPill variant="full">Not connected</StatusPill>
                  )}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-[15px] leading-[22px] text-slate">
              When all {a.limit} spots are filled, new join requests switch off. There&apos;s no waitlist in V1.
            </p>
          </div>
        </div>
      </PageContainer>
    </>
  );
}

function ManageSkeleton() {
  return (
    <PageContainer>
      <div aria-busy="true" className="grid gap-7 md:mt-12 md:grid-cols-2 lg:grid-cols-[1.3fr_1fr]">
        <div className="h-[480px] animate-pulse rounded-card bg-hover" />
        <div className="h-[320px] animate-pulse rounded-card bg-hover" />
      </div>
    </PageContainer>
  );
}
