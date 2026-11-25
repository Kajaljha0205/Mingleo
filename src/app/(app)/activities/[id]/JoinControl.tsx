"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { Check, Clock, MessageSquare, Settings2 } from "lucide-react";
import { Button, buttonClasses } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import type { Phase, ViewerState } from "@/server/activities";
import { requestToJoin, withdrawFromActivity, withdrawJoinRequest } from "../actions";

type Props = {
  activityId: string;
  hostName: string;
  initial: ViewerState;
  full: boolean;
  phase: Phase;
};

/** ST-103: one control for every viewer state (§8 S11 table). */
export function JoinControl({ activityId, hostName, initial, full, phase }: Props) {
  const toast = useToast();
  const [state, setState] = useState<ViewerState>(initial);
  const [pending, startTransition] = useTransition();
  const inline = useRef<HTMLDivElement>(null);
  const [inlineVisible, setInlineVisible] = useState(true);

  // Q-08: on mobile the primary action also sits in a sticky bar while the inline card is off-screen.
  useEffect(() => {
    const el = inline.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setInlineVisible(e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  function run(optimistic: ViewerState, action: () => Promise<{ state?: ViewerState; error?: string }>, success: string) {
    const previous = state;
    setState(optimistic);
    startTransition(async () => {
      const result = await action();
      if (result.error) {
        setState(previous);
        toast.show(result.error, "error");
        return;
      }
      setState(result.state ?? optimistic);
      toast.show(success);
    });
  }

  const request = () =>
    run("requested", () => requestToJoin(activityId), `Request sent. ${hostName} will let you know.`);

  if (phase === "cancelled") return null; // The "Cancelled by host" banner says it all.

  let control: ReactNode;
  let primary: ReactNode = null;
  if (phase === "completed" && (state === "host" || state === "accepted")) {
    control = (
      <div className="flex flex-col gap-2.5">
        <Link href={`/activities/${activityId}/after`} className={buttonClasses("primary")}>
          After the activity
        </Link>
        <Link href={`/activities/${activityId}/chat`} className={buttonClasses("light")}>
          <MessageSquare size={18} strokeWidth={1.8} aria-hidden="true" />
          Group chat
        </Link>
      </div>
    );
  } else if (state === "host") {
    control = primary = (
      <Link href={`/activities/${activityId}/manage`} className={buttonClasses("primary")}>
        <Settings2 size={18} strokeWidth={1.8} aria-hidden="true" />
        Manage activity
      </Link>
    );
  } else if (state === "accepted") {
    control = (
      <div className="flex flex-col gap-2.5">
        <p className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full bg-sage text-[15px] font-bold text-sage-text">
          <Check size={18} strokeWidth={1.8} aria-hidden="true" />
          You&apos;re in
        </p>
        <Link href={`/activities/${activityId}/chat`} className={buttonClasses("light")}>
          <MessageSquare size={18} strokeWidth={1.8} aria-hidden="true" />
          Open chat
        </Link>
        <Button
          variant="secondary"
          disabled={pending || phase !== "open"}
          onClick={() =>
            run("withdrawn", () => withdrawFromActivity(activityId), `You've left. ${hostName} has been told.`)
          }
        >
          Withdraw from activity
        </Button>
      </div>
    );
  } else if (state === "requested") {
    control = (
      <div className="flex flex-col gap-2.5">
        <p className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full bg-sunshine px-4 text-center text-[15px] font-semibold text-sunshine-text">
          <Clock size={18} strokeWidth={1.8} aria-hidden="true" />
          Requested · waiting for {hostName}
        </p>
        <Button
          variant="secondary"
          disabled={pending}
          onClick={() => run("none", () => withdrawJoinRequest(activityId), "Request withdrawn.")}
        >
          Withdraw request
        </Button>
      </div>
    );
  } else if (state === "declined") {
    control = (
      <p className="rounded-input bg-neutral-pill px-4 py-3.5 text-center text-[15px] font-semibold text-slate">
        {hostName} couldn&apos;t fit you in this time
      </p>
    );
  } else if (phase !== "open") {
    control = <Button disabled>Requests closed</Button>;
  } else if (full) {
    control = <Button disabled>Full · requests closed</Button>;
  } else {
    control = primary = (
      <Button disabled={pending} onClick={request}>
        Request to join
      </Button>
    );
  }

  return (
    <>
      <div ref={inline} className="mt-5" data-testid="join-control">
        {control}
      </div>
      {state !== "host" && (
        <p className="mt-4 text-center text-[14px] leading-5 text-slate">
          {hostName} approves every request. Joining doesn&apos;t make you connections.
        </p>
      )}
      {primary && !inlineVisible && (
        <div
          data-testid="sticky-action"
          className="fixed inset-x-0 bottom-[calc(68px+env(safe-area-inset-bottom))] z-30 border-t border-border bg-white px-4 py-3 md:hidden"
        >
          {primary}
        </div>
      )}
    </>
  );
}
