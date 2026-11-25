import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { CalendarDays, Check, Inbox as InboxIcon, MessageSquare, X } from "lucide-react";
import { MobileHeader, PageContainer } from "@/components/app/AppShell";
import { Avatar } from "@/components/ui/Avatar";
import { buttonClasses } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { chatPreview, earlierRow, type ChatRow, type InboxNotification, type RowIcon } from "@/lib/inbox";
import { coverFor } from "@/lib/interests";
import { relativeTime } from "@/lib/time";
import { loadChats, loadNotifications } from "@/server/inbox";
import { loadInterests, requireOnboarded } from "@/server/profile";
import { ConnectionRequestCard } from "./ConnectionRequestCard";
import { MarkRead } from "./MarkRead";

/** S20 Inbox: Notifications | Chats (?tab=chats). */
export default function InboxPage({ searchParams }: PageProps<"/inbox">) {
  return (
    <>
      <MobileHeader title="Inbox" back={{ href: "/activities", label: "Back", history: true }} />
      <PageContainer>
        <div className="mx-auto w-full max-w-[760px]">
          <div className="sr-only md:not-sr-only">
            <h1 className="font-display text-[30px] leading-9 font-extrabold tracking-[-0.02em] lg:text-[40px] lg:leading-[48px]">
              Inbox
            </h1>
            <p className="mt-1 text-[16px] leading-6 text-slate">
              Requests, decisions and chats in one place. Opened from the bell or chat icon on every screen.
            </p>
          </div>
          <Suspense fallback={<InboxSkeleton />}>
            <Inbox searchParams={searchParams} />
          </Suspense>
        </div>
      </PageContainer>
    </>
  );
}

async function Inbox({ searchParams }: Pick<PageProps<"/inbox">, "searchParams">) {
  const { tab } = await searchParams;
  const chatsTab = tab === "chats";
  const { supabase, userId } = await requireOnboarded();
  const catalogue = await loadInterests(supabase);
  const [notifications, chats] = await Promise.all([loadNotifications(supabase), loadChats(supabase, catalogue)]);
  const unreadChats = chats.reduce((n, c) => n + c.unread, 0);
  const now = new Date();

  return (
    <>
      <SegmentedControl
        label="Inbox"
        className="w-full max-w-[420px] md:mt-6"
        segments={[
          { label: `Notifications · ${notifications.unread}`, href: "/inbox", current: !chatsTab },
          { label: `Chats · ${unreadChats}`, href: "/inbox?tab=chats", current: chatsTab },
        ]}
      />
      {chatsTab ? (
        <Chats chats={chats} userId={userId} now={now} />
      ) : (
        <Notifications items={notifications.items} unread={notifications.unread} now={now} />
      )}
    </>
  );
}

function Eyebrow({ id, children }: { id: string; children: string }) {
  return (
    <h2 id={id} className="mt-7 mb-3 text-[13px] font-bold tracking-[0.08em] text-slate uppercase">
      {children}
    </h2>
  );
}

function Notifications({ items, unread, now }: { items: InboxNotification[]; unread: number; now: Date }) {
  const reply = items.filter((n) => n.needsReply);
  const earlier = items.filter((n) => !n.needsReply);
  if (!items.length) {
    return (
      <div className="mt-6">
        <EmptyState
          icon={<InboxIcon size={28} strokeWidth={1.8} aria-hidden="true" />}
          title="You're all caught up"
          help="Connection requests, join decisions and new activities from your people show up here."
        />
      </div>
    );
  }
  return (
    <>
      {unread > 0 && <MarkRead />}
      {reply.length > 0 && (
        <section aria-labelledby="reply-heading">
          <Eyebrow id="reply-heading">Needs your reply</Eyebrow>
          <ul className="flex flex-col gap-3">
            {reply.map((n) => (
              <li key={n.id}>
                {n.type === "connection_request" && n.actor ? (
                  <ConnectionRequestCard actor={n.actor} when={relativeTime(new Date(n.createdAt), now)} />
                ) : (
                  <JoinRequestCard n={n} when={relativeTime(new Date(n.createdAt), now)} />
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
      {earlier.length > 0 && (
        <section aria-labelledby="earlier-heading">
          <Eyebrow id="earlier-heading">Earlier</Eyebrow>
          <ul className="overflow-hidden rounded-card border border-border bg-white">
            {earlier.map((n) => {
              const row = earlierRow(n);
              const when = relativeTime(new Date(n.createdAt), now);
              return (
                <li key={n.id} className="border-b border-border last:border-0">
                  <Link
                    href={row.href}
                    className="flex items-center gap-3.5 px-4 py-3.5 hover:bg-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-600 md:px-5"
                  >
                    <RowBadge icon={row.icon} actor={n.actor} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[16px] leading-[22px] text-charcoal">
                        {row.parts.map((p, i) => (p.bold ? <strong key={i} className="font-bold">{p.text}</strong> : <span key={i}>{p.text}</span>))}
                      </span>
                      <span className="mt-0.5 block text-[14px] text-slate">{row.sub ? `${row.sub} · ${when}` : when}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </>
  );
}

const ICONS: Record<Exclude<RowIcon, "avatar">, { Icon: typeof Check; className: string }> = {
  check: { Icon: Check, className: "bg-sage text-sage-text" },
  calendar: { Icon: CalendarDays, className: "bg-light-blue text-blue-700" },
  cancel: { Icon: X, className: "bg-danger-tint text-danger-tint-text" },
};

function RowBadge({ icon, actor }: { icon: RowIcon; actor: InboxNotification["actor"] }) {
  if (icon === "avatar" && actor) return <Avatar id={actor.id} name={actor.firstName} photoUrl={actor.photoUrl} size={48} />;
  const { Icon, className } = ICONS[icon === "avatar" ? "calendar" : icon];
  return (
    <span className={`inline-flex size-12 shrink-0 items-center justify-center rounded-full ${className}`}>
      <Icon size={20} strokeWidth={1.8} aria-hidden="true" />
    </span>
  );
}

function JoinRequestCard({ n, when }: { n: InboxNotification; when: string }) {
  const a = n.actor!;
  return (
    <article className="flex items-center gap-3.5 rounded-card border border-border bg-white p-4 md:p-5">
      <Avatar id={a.id} name={a.firstName} photoUrl={a.photoUrl} size={48} />
      <div className="min-w-0 flex-1">
        <h3 className="font-display text-[17px] leading-6 font-bold">
          {a.firstName} asked to join {n.activity?.title}
        </h3>
        <p className="text-[14px] text-slate">
          {a.connected ? "Connected" : "Not connected"} · {when}
        </p>
      </div>
      <Link
        href={`/activities/${n.activity?.id}/manage`}
        aria-label={`Review ${a.firstName}'s request to join ${n.activity?.title}`}
        className={`${buttonClasses("light", "small")} w-auto! shrink-0`}
      >
        Review
      </Link>
    </article>
  );
}

function Chats({ chats, userId, now }: { chats: ChatRow[]; userId: string; now: Date }) {
  return (
    <section aria-label="Chats" className="mt-6">
      <p className="mb-3 text-[15px] leading-[22px] text-slate">
        You can message connections directly, and anyone you&apos;re doing an activity with in its group chat.
      </p>
      {chats.length ? (
        <ul className="overflow-hidden rounded-card border border-border bg-white">
          {chats.map((c) => {
            const cover = c.interestSlug ? coverFor(c.interestSlug) : null;
            return (
              <li key={c.id} className="border-b border-border last:border-0">
                <Link
                  href={c.href}
                  data-testid="chat-row"
                  className="flex items-center gap-3.5 px-4 py-3.5 hover:bg-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-600 md:px-5"
                >
                  {c.other ? (
                    <Avatar id={c.other.id} name={c.other.firstName} photoUrl={c.other.photoUrl} size={48} />
                  ) : (
                    <span className="relative size-12 shrink-0 overflow-hidden rounded-[14px] bg-sand">
                      {cover && <Image src={cover} alt="" fill unoptimized sizes="48px" className="object-cover" />}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-display text-[17px] leading-6 font-bold">{c.name}</span>
                    <span className={`block truncate text-[14px] ${c.unread ? "font-semibold text-charcoal" : "text-slate"}`}>
                      {chatPreview(c, userId)}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    {c.last && <span className="text-[13px] text-slate">{relativeTime(new Date(c.last.at), now)}</span>}
                    {c.unread > 0 && (
                      <span
                        aria-label={`${c.unread} unread`}
                        className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-blue-600 px-1.5 text-[12px] font-bold text-white"
                      >
                        {c.unread}
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState
          icon={<MessageSquare size={28} strokeWidth={1.8} aria-hidden="true" />}
          title="No chats yet"
          help="Connect with someone or join an activity to start chatting."
        />
      )}
    </section>
  );
}

function InboxSkeleton() {
  return (
    <div aria-busy="true" className="md:mt-6">
      <div className="h-[52px] w-full max-w-[420px] animate-pulse rounded-full bg-hover" />
      <div className="mt-8 h-[160px] animate-pulse rounded-card bg-hover" />
      <div className="mt-3 h-[96px] animate-pulse rounded-card bg-hover" />
    </div>
  );
}
