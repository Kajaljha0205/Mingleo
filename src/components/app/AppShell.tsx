import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { Bell, ChevronLeft, MessageSquare } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { HistoryBackLink } from "@/components/ui/HistoryBackLink";
import { IconLink } from "@/components/ui/IconButton";
import { Wordmark } from "@/components/ui/Wordmark";
import { unreadCount } from "@/server/discover";
import { unreadChatCount } from "@/server/inbox";
import { loadProfile, photoUrl, requireUser } from "@/server/profile";
import { BottomBar, BottomBarList, TopNavLinks, TopNavList } from "./NavLinks";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-ivory">
      <header className="sticky top-0 z-40 hidden h-[72px] border-b border-border bg-white md:block">
        <div className="mx-auto flex h-full max-w-[1240px] items-center gap-3 px-8 lg:gap-6 lg:px-12">
          <Link href="/activities" aria-label="mingleo home" className="shrink-0 rounded-input focus-visible:outline-2 focus-visible:outline-blue-600">
            <Wordmark />
          </Link>
          <nav aria-label="Main" className="min-w-0 flex-1">
            <Suspense fallback={<TopNavList />}>
              <TopNavLinks />
            </Suspense>
          </nav>
          <Suspense fallback={<div className="h-11 w-[150px]" />}>
            <HeaderActions withAvatar />
          </Suspense>
        </div>
      </header>
      {children}
      <Suspense fallback={<BottomBarList />}>
        <BottomBar />
      </Suspense>
    </div>
  );
}

/** Bell (unread dot) + Messages (+ avatar on the top bar). Both icons open Inbox on the matching tab. */
async function HeaderActions({ withAvatar = false }: { withAvatar?: boolean }) {
  const { supabase, userId } = await requireUser();
  const [unread, unreadChats, profile] = await Promise.all([
    unreadCount(supabase, userId),
    unreadChatCount(supabase),
    withAvatar ? loadProfile(supabase, userId) : null,
  ]);
  return (
    <div className="flex items-center gap-1 md:gap-2">
      <IconLink href="/inbox" label={unread ? `Notifications, ${unread} unread` : "Notifications"} className="relative">
        <Bell size={22} strokeWidth={1.8} aria-hidden="true" />
        {unread > 0 && (
          <span data-testid="unread-dot" className="absolute top-2 right-2.5 size-2 rounded-full bg-mingle-blue ring-2 ring-white" />
        )}
      </IconLink>
      <IconLink href="/inbox?tab=chats" label={unreadChats ? `Messages, ${unreadChats} unread` : "Messages"} className="relative">
        <MessageSquare size={22} strokeWidth={1.8} aria-hidden="true" />
        {unreadChats > 0 && (
          <span data-testid="unread-chats-dot" className="absolute top-2 right-2 size-2 rounded-full bg-mingle-blue ring-2 ring-white" />
        )}
      </IconLink>
      {profile && (
        <Link
          href="/profile"
          aria-label="Your profile"
          className="ml-1 rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          <Avatar id={profile.id} name={profile.firstName ?? ""} photoUrl={photoUrl(profile.photoPath)} size={40} />
        </Link>
      )}
    </div>
  );
}

/** Mobile (< 768 px) sticky header: section title + bell/messages, or back button + page name. */
export function MobileHeader(
  props: { title: string; back?: undefined } | { title: string; back: { href: string; label: string; history?: boolean } },
) {
  return (
    <div className="sticky top-0 z-30 flex h-[62px] items-center gap-3 bg-ivory px-4 md:hidden">
      {props.back ? (
        <>
          {props.back.history ? (
            <HistoryBackLink href={props.back.href} label={props.back.label} />
          ) : (
            <IconLink href={props.back.href} label={props.back.label} bordered>
              <ChevronLeft size={22} strokeWidth={1.8} aria-hidden="true" />
            </IconLink>
          )}
          <p className="truncate font-display text-[19px] font-bold">{props.title}</p>
        </>
      ) : (
        <>
          <p className="flex-1 font-display text-[26px] leading-8 font-extrabold tracking-[-0.02em]">{props.title}</p>
          <Suspense fallback={<div className="h-11 w-[92px]" />}>
            <HeaderActions />
          </Suspense>
        </>
      )}
    </div>
  );
}

/** Page container paddings (ST-034): mobile 6/16/108, tablet 28/32/56, desktop 36/48/64; max 1240. */
export function PageContainer({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-[1240px] flex-1 px-4 pt-1.5 pb-[calc(108px+env(safe-area-inset-bottom))] md:px-8 md:pt-7 md:pb-14 lg:px-12 lg:pt-9 lg:pb-16">
      {children}
    </main>
  );
}
