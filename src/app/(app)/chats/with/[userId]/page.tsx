import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { PageContainer } from "@/components/app/AppShell";
import { directConversationId } from "@/server/chat";
import { requireOnboarded } from "@/server/profile";

/** Opens (or creates) the direct chat with a connection — S09 Message and later S18 / S20 / S21. */
export default function DirectChatWithPage({ params }: PageProps<"/chats/with/[userId]">) {
  return (
    <Suspense fallback={<PageContainer><div aria-busy="true" className="mx-auto h-[640px] max-w-[760px] animate-pulse rounded-card bg-hover" /></PageContainer>}>
      <Resolve params={params} />
    </Suspense>
  );
}

async function Resolve({ params }: Pick<PageProps<"/chats/with/[userId]">, "params">): Promise<null> {
  const { userId } = await params;
  const { supabase } = await requireOnboarded();
  const cid = await directConversationId(supabase, userId);
  if (!cid) notFound();
  redirect(`/chats/${cid}`);
}
