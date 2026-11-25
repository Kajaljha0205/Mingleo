import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CalendarDays, Check, MapPin, Users } from "lucide-react";
import { MobileHeader, PageContainer } from "@/components/app/AppShell";
import { ActivityCover } from "@/components/cards/ActivityCard";
import { ChatRoom } from "@/components/chat/ChatRoom";
import { WithdrawFromActivity } from "@/components/chat/WithdrawFromActivity";
import { AvatarStack } from "@/components/ui/Avatar";
import { BackLink } from "@/components/ui/BackLink";
import { buttonClasses } from "@/components/ui/Button";
import { StatusPill } from "@/components/ui/StatusPill";
import { readOnlyCopy } from "@/lib/chat";
import { distanceLabel } from "@/lib/format";
import { coverFor } from "@/lib/interests";
import { cardDateTime, dateTimeRange } from "@/lib/time";
import { activityConversationId, loadThread, type ChatThread } from "@/server/chat";
import { loadInterests, requireOnboarded } from "@/server/profile";

/** S16 Activity chat — host + accepted participants only (everyone else gets the same 404). */
export default function ActivityChatPage({ params }: PageProps<"/activities/[id]/chat">) {
  return (
    <Suspense fallback={<ChatSkeleton />}>
      <ActivityChat params={params} />
    </Suspense>
  );
}

async function ActivityChat({ params }: Pick<PageProps<"/activities/[id]/chat">, "params">) {
  const { id } = await params;
  const { supabase, userId } = await requireOnboarded();
  const catalogue = await loadInterests(supabase);
  const cid = await activityConversationId(supabase, id);
  const thread = cid ? await loadThread(supabase, cid, catalogue) : null;
  if (!thread?.activity) notFound();
  const a = thread.activity;
  const backHref = a.viewerRole === "host" ? `/activities/${a.id}/manage` : `/activities/${a.id}`;
  const others = thread.members.filter((m) => m.id !== userId);

  return (
    <>
      <MobileHeader title={a.title} back={{ href: backHref, label: "Back to the activity" }} />
      <PageContainer>
        <BackLink href={backHref} label="Back to the activity" />
        <div className="grid gap-6 md:mt-6 lg:grid-cols-[1.55fr_1fr] lg:gap-10">
          <ChatRoom
            conversationId={thread.id}
            viewerId={userId}
            members={thread.members}
            initialMessages={thread.messages}
            hasMore={thread.hasMore}
            readOnly={readOnlyCopy(thread.readOnly)}
            placeholder="Message the group"
            quickReplies
            header={
              <div className="flex items-center gap-3.5">
                <span className="relative size-14 shrink-0 overflow-hidden rounded-input bg-sand">
                  {coverFor(a.interest.slug) && (
                    <Image src={coverFor(a.interest.slug)!} alt="" fill unoptimized sizes="56px" className="object-cover" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <h1 className="truncate font-display text-[19px] leading-[26px] font-bold">{a.title}</h1>
                  <p className="text-[15px] text-slate">
                    {cardDateTime(new Date(a.startsAt))} · {a.going} going
                  </p>
                </div>
                <AvatarStack
                  people={others.slice(0, 3).map((m) => ({ id: m.id, name: m.firstName, photoUrl: m.photoUrl }))}
                />
              </div>
            }
            intro={
              <div className="mb-2 flex flex-col items-center gap-2 text-center">
                {a.viewerRole === "participant" && (
                  <p className="inline-flex items-center gap-2 rounded-full bg-sage px-4 py-2 text-[15px] font-semibold text-sage-text">
                    <Check size={16} strokeWidth={1.8} aria-hidden="true" />
                    {a.hostFirstName} accepted you. You&apos;re in!
                  </p>
                )}
                <p className="text-[14px] text-slate">Only accepted participants can see this chat</p>
              </div>
            }
          />
          <SideCard thread={thread} />
        </div>
      </PageContainer>
    </>
  );
}

/** Desktop side card / mobile inline card: date, exact location, n of N, Withdraw (participants only). */
function SideCard({ thread }: { thread: ChatThread }) {
  const a = thread.activity!;
  const full = a.going >= a.limit;
  return (
    <aside aria-label="Activity details" className="min-w-0 self-start overflow-hidden rounded-card border border-border bg-white lg:sticky lg:top-[108px]">
      <ActivityCover
        slug={a.interest.slug}
        interestName={a.interest.name}
        className="hidden h-[180px] lg:block"
        sizes="420px"
        chips={<></>}
      />
      <div className="flex flex-col gap-3.5 p-5">
        <p className="hidden font-display text-[19px] leading-[26px] font-bold lg:block">{a.title}</p>
        <p className="flex items-start gap-3 text-[16px]">
          <CalendarDays size={20} strokeWidth={1.8} aria-hidden="true" className="mt-0.5 shrink-0 text-blue-600" />
          {dateTimeRange(new Date(a.startsAt), a.endsAt ? new Date(a.endsAt) : null)}
        </p>
        <div className="flex items-start gap-3 text-[16px]">
          <MapPin size={20} strokeWidth={1.8} aria-hidden="true" className="mt-0.5 shrink-0 text-blue-600" />
          <div className="min-w-0 break-words">
            {a.address && <p className="font-semibold">{a.address}</p>}
            <p className={a.address ? "text-slate" : ""}>
              {a.areaName} · {distanceLabel(a.distanceKm)}
            </p>
          </div>
        </div>
        <p className="flex items-center gap-3 text-[16px]">
          <Users size={20} strokeWidth={1.8} aria-hidden="true" className="shrink-0 text-blue-600" />
          <span className="flex-1">
            {a.going} of {a.limit} going
          </span>
          {full && <StatusPill variant="full">Full</StatusPill>}
        </p>
        {a.phase === "completed" && (
          <Link href={`/activities/${a.id}/after`} className={buttonClasses("secondary")}>
            After the activity
          </Link>
        )}
        {a.viewerRole === "participant" && (a.phase === "open" || a.phase === "started") && !thread.readOnly && (
          <WithdrawFromActivity activityId={a.id} hostName={a.hostFirstName} />
        )}
      </div>
    </aside>
  );
}

function ChatSkeleton() {
  return (
    <PageContainer>
      <div aria-busy="true" className="grid gap-6 md:mt-12 lg:grid-cols-[1.55fr_1fr]">
        <div className="h-[640px] animate-pulse rounded-card bg-hover" />
        <div className="h-[320px] animate-pulse rounded-card bg-hover" />
      </div>
    </PageContainer>
  );
}
