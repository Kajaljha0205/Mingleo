"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Check, ChevronRight, Clock, Flag, MessageSquare, Plus, UserPlus } from "lucide-react";
import { connect, withdrawRequest } from "@/app/(app)/people/actions";
import { reportActivity } from "@/app/(app)/chats/actions";
import { ReportSheet } from "@/components/safety/ReportSheet";
import { Button, buttonClasses } from "@/components/ui/Button";
import { StatusPill } from "@/components/ui/StatusPill";
import { useToast } from "@/components/ui/Toast";
import type { Relationship } from "@/server/discover";

/** S17 control: Connect / Pending (tap to withdraw) / Connected pill — optimistic with rollback (ST-084). */
export function PlayedWithControl({ personId, name, initial }: { personId: string; name: string; initial: Relationship }) {
  const toast = useToast();
  const [state, setState] = useState<Relationship>(initial);
  const [pending, startTransition] = useTransition();

  function run(optimistic: Relationship, action: () => Promise<{ state?: Relationship; error?: string }>, success: string) {
    const previous = state;
    setState(optimistic);
    startTransition(async () => {
      const result = await action();
      if (result.error) {
        setState(previous);
        return toast.show(result.error, "error");
      }
      setState(result.state ?? optimistic);
      toast.show(result.state === "connected" ? `You\u2019re now connected with ${name}.` : success);
    });
  }

  if (state === "connected") {
    return (
      <StatusPill variant="positive">
        <Check size={14} strokeWidth={1.8} aria-hidden="true" />
        Connected
      </StatusPill>
    );
  }
  if (state === "sent") {
    return (
      <Button
        size="small"
        className="w-auto! bg-sunshine! text-sunshine-text! hover:bg-sunshine/80!"
        aria-label={`Pending. Withdraw request to ${name}`}
        disabled={pending}
        leadingIcon={<Clock size={16} strokeWidth={1.8} aria-hidden="true" />}
        onClick={() => run("none", () => withdrawRequest(personId), "Request withdrawn.")}
      >
        Pending
      </Button>
    );
  }
  return (
    <Button
      size="small"
      className="w-auto!"
      aria-label={`Connect with ${name}`}
      disabled={pending}
      leadingIcon={<UserPlus size={16} strokeWidth={1.8} aria-hidden="true" />}
      onClick={() => run("sent", () => connect(personId), `Request sent. We\u2019ll tell you when ${name} accepts.`)}
    >
      Connect
    </Button>
  );
}

/** S17 side card: re-host, group chat link, report (ST-132, ST-193). */
export function AfterSide({ activityId, chatClosed }: { activityId: string; chatClosed: boolean }) {
  const toast = useToast();
  const [reporting, setReporting] = useState(false);
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-card bg-light-blue p-5 lg:p-6">
        <h2 className="font-display text-[22px] leading-7 font-bold text-blue-700">Same time next week?</h2>
        <p className="mt-2 text-[16px] leading-6">We&apos;ll copy the details from this activity. You just pick a new date and time.</p>
        <Link href={`/activities/new?from=${activityId}`} className={`${buttonClasses("primary")} mt-4`}>
          <Plus size={20} strokeWidth={1.8} aria-hidden="true" />
          Re-host this activity
        </Link>
      </div>
      <Link
        href={`/activities/${activityId}/chat`}
        className="flex min-h-14 items-center gap-3 rounded-card border border-border bg-white px-4 text-[16px] font-semibold hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
      >
        <MessageSquare size={20} strokeWidth={1.8} aria-hidden="true" className="text-blue-600" />
        <span className="flex-1">{chatClosed ? "Group chat (read-only now)" : "Group chat stays open for 7 days"}</span>
        <ChevronRight size={20} strokeWidth={1.8} aria-hidden="true" />
      </Link>
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => setReporting(true)}
        className="flex min-h-11 items-center gap-2.5 self-start rounded-input px-1 text-[16px] font-semibold text-slate hover:text-charcoal focus-visible:outline-2 focus-visible:outline-blue-600"
      >
        <Flag size={18} strokeWidth={1.8} aria-hidden="true" />
        Report a problem with this activity
      </button>
      <ReportSheet
        open={reporting}
        onClose={() => setReporting(false)}
        title="Report a problem"
        submit={(reason, note) => reportActivity(activityId, reason, note)}
        onDone={() => {
          setReporting(false);
          toast.show("Thanks. We\u2019ll review your report.");
        }}
      />
    </div>
  );
}
