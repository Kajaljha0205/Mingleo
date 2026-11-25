"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { SendHorizontal } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { useToast } from "@/components/ui/Toast";
import { loadEarlier, markRead, sendMessage } from "@/app/(app)/chats/actions";
import { MESSAGE_MAX, mergeMessages, QUICK_REPLIES, type Msg } from "@/lib/chat";
import { browserClient } from "@/lib/supabase/browser";

export type RoomMember = { id: string; firstName: string; photoUrl: string | null; isHost: boolean; lastReadAt: string | null };

type Props = {
  conversationId: string;
  viewerId: string;
  members: RoomMember[];
  initialMessages: Msg[];
  hasMore: boolean;
  /** Copy shown instead of the composer when the chat is read-only. */
  readOnly: string | null;
  placeholder: string;
  quickReplies?: boolean;
  header: ReactNode;
  intro?: ReactNode;
};

/** ST-143 / ST-144: message list + composer; new messages arrive via Supabase Realtime (ST-142). */
export function ChatRoom({
  conversationId,
  viewerId,
  members,
  initialMessages,
  hasMore: initialHasMore,
  readOnly,
  placeholder,
  quickReplies = false,
  header,
  intro,
}: Props) {
  const toast = useToast();
  const router = useRouter();
  // Server copy (props, refreshed by router.refresh()) merged with what arrived or was sent here.
  const [local, setMessages] = useState<Msg[]>([]);
  const messages = useMemo(() => mergeMessages(initialMessages, local), [initialMessages, local]);
  const [sending, setSending] = useState<Set<string>>(new Set());
  const [draft, setDraft] = useState("");
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loadingEarlier, startEarlier] = useTransition();
  const list = useRef<HTMLDivElement>(null);
  const lastId = useRef<string | undefined>(undefined);
  const tmp = useRef(0);
  const known = useRef(new Set(members.map((m) => m.id)));
  const readTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // Read times pushed live (ST-143.6), on top of what the server sent with the page.
  const [liveReads, setLiveReads] = useState<Record<string, string>>({});

  const byId = new Map(members.map((m) => [m.id, m]));

  useEffect(() => {
    known.current = new Set(members.map((x) => x.id));
  }, [members]);

  // Mark read when the chat opens and (shortly after) new messages arrive — only while the tab is visible.
  const markReadSoon = useCallback(() => {
    clearTimeout(readTimer.current);
    readTimer.current = setTimeout(() => {
      if (document.visibilityState === "visible") void markRead(conversationId);
    }, 800);
  }, [conversationId]);

  useEffect(() => {
    markReadSoon();
    const onVisible = () => document.visibilityState === "visible" && markReadSoon();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      clearTimeout(readTimer.current);
    };
  }, [markReadSoon]);

  useEffect(() => {
    const sb = browserClient();
    let channel: ReturnType<typeof sb.channel> | null = null;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await sb.auth.getSession();
        await sb.realtime.setAuth(data.session?.access_token ?? null);
        if (cancelled) return;
        channel = sb
          .channel(`chat:${conversationId}`)
          .on(
            "postgres_changes",
            { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
            (payload: { new: Record<string, string> }) => {
              const r = payload.new;
              const msg: Msg = { id: r.id, senderId: r.sender_id, body: r.body, createdAt: r.created_at };
              setMessages((m) => mergeMessages(m, [msg]));
              if (msg.senderId !== viewerId) {
                // Someone who joined after this page loaded: fetch their name/avatar.
                if (!known.current.has(msg.senderId)) router.refresh();
                markReadSoon();
              }
            },
          )
          .on(
            "postgres_changes",
            { event: "UPDATE", schema: "public", table: "conversation_members", filter: `conversation_id=eq.${conversationId}` },
            (payload: { new: Record<string, string> }) => {
              const { user_id, last_read_at } = payload.new;
              if (user_id && last_read_at) setLiveReads((r) => ({ ...r, [user_id]: last_read_at }));
            },
          )
          .subscribe();
      } catch {
        // Realtime unavailable: messages still show on reload / after sending.
      }
    })();
    return () => {
      cancelled = true;
      if (channel) void sb.removeChannel(channel);
    };
  }, [conversationId, viewerId, router, markReadSoon]);

  // Stick to the newest message when one arrives at the end (not when loading earlier ones).
  useLayoutEffect(() => {
    const newest = messages.at(-1)?.id;
    if (newest !== lastId.current && list.current) list.current.scrollTop = list.current.scrollHeight;
    lastId.current = newest;
  }, [messages]);

  function send(text: string, fromComposer: boolean) {
    const body = text.trim();
    if (!body || body.length > MESSAGE_MAX) return;
    const id = `tmp-${++tmp.current}`;
    const optimistic: Msg = { id, senderId: viewerId, body, createdAt: new Date().toISOString() };
    setMessages((m) => mergeMessages(m, [optimistic]));
    setSending((s) => new Set(s).add(id));
    if (fromComposer) setDraft("");
    void sendMessage(conversationId, body).then((result) => {
      setMessages((m) => mergeMessages(m.filter((x) => x.id !== id), result.message ? [result.message] : []));
      setSending((s) => {
        const next = new Set(s);
        next.delete(id);
        return next;
      });
      if (result.error) {
        toast.show(result.error, "error");
        if (fromComposer) setDraft((d) => d || body);
      }
    });
  }

  const lastOwn = [...messages].reverse().find((m) => m.senderId === viewerId);
  const seenBy = lastOwn
    ? members.filter((m) => {
        if (m.id === viewerId) return false;
        const read = Math.max(Date.parse(m.lastReadAt ?? "") || 0, Date.parse(liveReads[m.id] ?? "") || 0);
        return read >= Date.parse(lastOwn.createdAt);
      }).length
    : 0;
  const ownStatus = !lastOwn
    ? null
    : sending.has(lastOwn.id)
      ? "Sending…"
      : seenBy > 0
        ? `Seen by ${seenBy}`
        : "Sent";

  return (
    <section aria-label="Chat" className="flex min-w-0 flex-col overflow-hidden rounded-card border border-border bg-white">
      <div className="border-b border-border px-4 py-3.5 md:px-5">{header}</div>

      <div
        ref={list}
        role="log"
        aria-label="Messages"
        aria-live="polite"
        className="h-[52dvh] min-h-[320px] overflow-y-auto bg-ivory/60 px-4 py-4 md:h-[480px] md:px-5"
      >
        {hasMore && (
          <div className="mb-3 text-center">
            <button
              type="button"
              disabled={loadingEarlier}
              onClick={() =>
                startEarlier(async () => {
                  const r = await loadEarlier(conversationId, messages[0]?.createdAt ?? new Date().toISOString());
                  setMessages((m) => mergeMessages(r.messages, m));
                  setHasMore(r.hasMore);
                })
              }
              className="min-h-11 rounded-full px-4 text-[14px] font-semibold text-blue-700 hover:bg-hover focus-visible:outline-2 focus-visible:outline-blue-600"
            >
              {loadingEarlier ? "Loading…" : "Load earlier messages"}
            </button>
          </div>
        )}
        {intro}
        <ol className="flex flex-col gap-1.5">
          {messages.map((m, i) => {
            const mine = m.senderId === viewerId;
            const sender = byId.get(m.senderId);
            const startsRun = messages[i - 1]?.senderId !== m.senderId;
            return (
              <li key={m.id} className={`flex flex-col ${startsRun ? "mt-2.5" : ""}`} data-testid="message">
                {!mine && startsRun && (
                  <p className="mb-1 ml-[46px] text-[13px] font-semibold text-slate">
                    {sender?.firstName ?? "Someone"}
                    {sender?.isHost && " · host"}
                  </p>
                )}
                <div className={`flex items-end gap-2.5 ${mine ? "justify-end" : ""}`}>
                  {!mine &&
                    (startsRun ? (
                      <Avatar id={m.senderId} name={sender?.firstName ?? "?"} photoUrl={sender?.photoUrl ?? null} size={36} />
                    ) : (
                      <span className="w-9 shrink-0" />
                    ))}
                  <p
                    className={`max-w-[80%] rounded-[20px] px-4 py-2.5 text-[16px] leading-[23px] break-words whitespace-pre-wrap ${
                      mine ? "bg-blue-600 text-white" : "border border-border bg-white text-charcoal"
                    } ${sending.has(m.id) ? "opacity-70" : ""}`}
                  >
                    {m.body}
                  </p>
                </div>
                {mine && m.id === lastOwn?.id && ownStatus && (
                  <p className="mt-1 text-right text-[13px] text-slate" data-testid="own-status">
                    {ownStatus}
                  </p>
                )}
              </li>
            );
          })}
        </ol>
      </div>

      <div className="border-t border-border px-4 py-3 md:px-5">
        {readOnly ? (
          <p role="status" className="rounded-input bg-neutral-pill px-4 py-3 text-center text-[15px] text-slate">
            {readOnly}
          </p>
        ) : (
          <>
            {quickReplies && (
              <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:flex-wrap md:px-0">
                {QUICK_REPLIES.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => send(q, false)}
                    className="inline-flex min-h-11 shrink-0 items-center rounded-full border border-border-input bg-white px-4 text-[15px] font-medium hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}
            <form
              className="flex items-center gap-2.5"
              onSubmit={(e) => {
                e.preventDefault();
                send(draft, true);
              }}
            >
              <label htmlFor="chat-input" className="sr-only">
                {placeholder}
              </label>
              <input
                id="chat-input"
                autoComplete="off"
                // Autofill extensions add attributes before hydration.
                suppressHydrationWarning
                value={draft}
                maxLength={MESSAGE_MAX}
                placeholder={placeholder}
                onChange={(e) => setDraft(e.target.value)}
                className="h-[52px] min-w-0 flex-1 rounded-full border border-border-input bg-white px-5 text-[16px] placeholder:text-slate focus:border-blue-600 focus:outline-[1.5px] focus:-outline-offset-1 focus:outline-blue-600"
              />
              <button
                type="submit"
                aria-label="Send"
                disabled={!draft.trim()}
                className="inline-flex size-[52px] shrink-0 items-center justify-center rounded-full bg-blue-600 text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50"
              >
                <SendHorizontal size={22} strokeWidth={1.8} aria-hidden="true" />
              </button>
            </form>
          </>
        )}
      </div>
    </section>
  );
}
