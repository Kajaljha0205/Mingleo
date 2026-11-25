import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { MobileHeader, PageContainer } from "@/components/app/AppShell";
import { ChatRoom } from "@/components/chat/ChatRoom";
import { Avatar } from "@/components/ui/Avatar";
import { BackLink } from "@/components/ui/BackLink";
import { readOnlyCopy } from "@/lib/chat";
import { loadThread } from "@/server/chat";
import { loadInterests, requireOnboarded } from "@/server/profile";

/** S16-D Direct chat: S16's layout with one person and no activity header (ST-144). */
export default function DirectChatPage({ params }: PageProps<"/chats/[id]">) {
  return (
    <Suspense fallback={<PageContainer><div aria-busy="true" className="mx-auto h-[640px] max-w-[760px] animate-pulse rounded-card bg-hover" /></PageContainer>}>
      <DirectChat params={params} />
    </Suspense>
  );
}

async function DirectChat({ params }: Pick<PageProps<"/chats/[id]">, "params">) {
  const { id } = await params;
  const { supabase, userId } = await requireOnboarded();
  const thread = await loadThread(supabase, id, await loadInterests(supabase));
  if (!thread?.other) notFound();
  const o = thread.other;
  const profileHref = `/people/${o.id}`;

  return (
    <>
      <MobileHeader title={o.firstName} back={{ href: profileHref, label: `Back to ${o.firstName}` }} />
      <PageContainer>
        <div className="mx-auto max-w-[760px]">
          <BackLink href={profileHref} label={`Back to ${o.firstName}`} />
          <div className="md:mt-6">
            <ChatRoom
              conversationId={thread.id}
              viewerId={userId}
              members={thread.members}
              initialMessages={thread.messages}
              hasMore={thread.hasMore}
              readOnly={readOnlyCopy(thread.readOnly)}
              placeholder={`Message ${o.firstName}`}
              header={
                <div className="flex items-center gap-3.5">
                  <Avatar id={o.id} name={o.firstName} photoUrl={o.photoUrl} size={48} />
                  <h1 className="min-w-0 flex-1 truncate font-display text-[19px] leading-[26px] font-bold">{o.firstName}</h1>
                  <Link
                    href={profileHref}
                    className="inline-flex min-h-11 shrink-0 items-center rounded-input px-1 text-[16px] font-semibold text-blue-700 hover:underline focus-visible:outline-2 focus-visible:outline-blue-600"
                  >
                    View profile
                  </Link>
                </div>
              }
            />
          </div>
        </div>
      </PageContainer>
    </>
  );
}
