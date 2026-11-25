import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { MobileHeader, PageContainer } from "@/components/app/AppShell";
import { ActivityCover } from "@/components/cards/ActivityCard";
import { Avatar } from "@/components/ui/Avatar";
import { BackLink } from "@/components/ui/BackLink";
import { StatusPill } from "@/components/ui/StatusPill";
import { togetherLine } from "@/lib/chat";
import { shortDate } from "@/lib/time";
import { loadAfterActivity } from "@/server/chat";
import { loadInterests, requireOnboarded } from "@/server/profile";
import { AfterSide, PlayedWithControl } from "./AfterControls";

/** S17 After the activity — completed activities the viewer took part in. */
export default function AfterPage({ params }: PageProps<"/activities/[id]/after">) {
  return (
    <Suspense fallback={<AfterSkeleton />}>
      <After params={params} />
    </Suspense>
  );
}

async function After({ params }: Pick<PageProps<"/activities/[id]/after">, "params">) {
  const { id } = await params;
  const { supabase } = await requireOnboarded();
  const a = await loadAfterActivity(supabase, id, await loadInterests(supabase));
  if (!a) notFound();
  if (a.phase !== "completed") redirect(`/activities/${id}`);

  return (
    <>
      <MobileHeader title="Completed" back={{ href: "/activities", label: "Back to Activities" }} />
      <PageContainer>
        <BackLink href="/activities" label="Back to Activities" />
        <div className="grid gap-7 md:mt-6 lg:grid-cols-[1.55fr_1fr] lg:gap-10">
          <div className="min-w-0">
            <div className="relative">
              <ActivityCover
                slug={a.interest.slug}
                interestName={a.interest.name}
                className="h-[220px] rounded-media md:h-[300px]"
                sizes="(min-width: 1024px) 720px, 100vw"
                priority
                chips={<></>}
              />
              <span className="absolute top-4 left-4">
                <StatusPill variant="positive">Completed · {shortDate(new Date(a.startsAt))}</StatusPill>
              </span>
            </div>
            {/* User decision: one heading for every interest (no "Good game" for sports). */}
            <h1 className="mt-6 font-display text-[30px] leading-9 font-extrabold tracking-[-0.02em] break-words lg:text-[40px] lg:leading-[48px]">
              Hope you enjoyed {a.title}, {a.viewerFirstName}!
            </h1>
            <p className="mt-2 text-[17px] leading-[26px] text-slate">
              Enjoyed meeting someone? Send a connection request and you&apos;ll see their connections-only activities.
            </p>

            <h2 className="mt-7 text-[13px] font-bold tracking-[0.08em] text-slate uppercase">You played with</h2>
            {a.participants.length === 0 ? (
              <p className="mt-3 rounded-card border border-border bg-white px-5 py-6 text-[15px] text-slate">
                Nobody else is listed for this activity.
              </p>
            ) : (
              <ul className="mt-3 grid gap-3 md:grid-cols-2" aria-label="You played with">
                {a.participants.map((p) => (
                  <li key={p.id} className="flex items-center gap-3.5 rounded-card border border-border bg-white p-4" data-testid="played-with">
                    <Link
                      href={`/people/${p.id}?from=activities`}
                      className="flex min-w-0 flex-1 items-center gap-3.5 rounded-input focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                    >
                      <Avatar id={p.id} name={p.firstName} photoUrl={p.photoUrl} size={48} />
                      <span className="min-w-0">
                        <span className="block truncate text-[17px] font-bold">{p.firstName}</span>
                        <span className="block text-[14px] text-slate">
                          {p.isHost ? `Host · ${togetherLine(p.together).toLowerCase()}` : togetherLine(p.together)}
                        </span>
                      </span>
                    </Link>
                    <PlayedWithControl personId={p.id} name={p.firstName} initial={p.relationship} />
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-4 text-[15px] leading-[22px] text-slate">
              Playing together never connects you automatically. Both people have to agree.
            </p>
          </div>
          <aside aria-label="What next" className="min-w-0 self-start lg:sticky lg:top-[108px]">
            <AfterSide activityId={a.id} chatClosed={a.chatReadOnly !== null} />
          </aside>
        </div>
      </PageContainer>
    </>
  );
}

function AfterSkeleton() {
  return (
    <PageContainer>
      <div aria-busy="true" className="grid gap-7 md:mt-12 lg:grid-cols-[1.55fr_1fr]">
        <div className="h-[300px] animate-pulse rounded-media bg-hover" />
        <div className="h-[220px] animate-pulse rounded-card bg-hover" />
      </div>
    </PageContainer>
  );
}
