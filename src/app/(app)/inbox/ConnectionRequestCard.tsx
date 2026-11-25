"use client";

import { useState, useTransition } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { DECLINE_UNDO_MS } from "@/lib/activity";
import { requestMeta, type InboxActor } from "@/lib/inbox";
import { respondToRequest, undoConnectionDecline } from "../people/actions";

/** "{name} wants to connect" with inline Decline (+ Undo) / Accept (ST-162.1/.3). */
export function ConnectionRequestCard({ actor, when }: { actor: InboxActor; when?: string }) {
  const toast = useToast();
  const [hidden, setHidden] = useState(false);
  const [pending, startTransition] = useTransition();
  const name = actor.firstName;

  function accept() {
    setHidden(true);
    startTransition(async () => {
      const r = await respondToRequest(actor.id, true);
      if (r.error) {
        setHidden(false);
        return toast.show(r.error, "error");
      }
      toast.show(`You\u2019re now connected with ${name}.`);
    });
  }

  function decline() {
    setHidden(true);
    startTransition(async () => {
      const r = await respondToRequest(actor.id, false);
      if (r.error) {
        setHidden(false);
        return toast.show(r.error, "error");
      }
      toast.show("Request declined.", "success", {
        durationMs: DECLINE_UNDO_MS,
        onUndo: () =>
          startTransition(async () => {
            const u = await undoConnectionDecline(actor.id);
            if (u.error) return toast.show(u.error, "error");
            setHidden(false);
          }),
      });
    });
  }

  if (hidden) return null;
  return (
    <article data-testid="connection-request" className="rounded-card border border-border bg-white p-4 md:p-5">
      <div className="flex items-center gap-3.5">
        <Avatar id={actor.id} name={name} photoUrl={actor.photoUrl} size={48} />
        <div className="min-w-0">
          <h3 className="font-display text-[17px] leading-6 font-bold">{name} wants to connect</h3>
          <p className="text-[14px] text-slate">{[requestMeta(actor), when].filter(Boolean).join(" · ")}</p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2.5">
        <Button variant="secondary" size="small" disabled={pending} onClick={decline} aria-label={`Decline ${name}`}>
          Decline
        </Button>
        <Button size="small" disabled={pending} onClick={accept} aria-label={`Accept ${name}`}>
          Accept
        </Button>
      </div>
    </article>
  );
}
