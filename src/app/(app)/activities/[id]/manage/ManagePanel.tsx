"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { MessageSquare, Pencil } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Button, buttonClasses } from "@/components/ui/Button";
import { TextAreaField } from "@/components/ui/FormField";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { CANCEL_NOTE_MAX, cancelBody, DECLINE_UNDO_MS } from "@/lib/activity";
import { distanceLabel } from "@/lib/format";
import type { JoinRequest } from "@/server/activities";
import { acceptRequest, cancelActivity, declineRequest, undoDecline } from "../../actions";

/** ST-121–123: request cards with Accept (capacity-safe) and Decline with a 10 s Undo. */
export function RequestsPanel({ requests, full, open }: { requests: JoinRequest[]; full: boolean; open: boolean }) {
  const toast = useToast();
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const visible = requests.filter((r) => !hidden.has(r.participationId));

  const hide = (id: string, on: boolean) =>
    setHidden((s) => {
      const next = new Set(s);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  function accept(r: JoinRequest) {
    setBusy(r.participationId);
    startTransition(async () => {
      const result = await acceptRequest(r.participationId);
      setBusy(null);
      if (result.error) return toast.show(result.error, "error");
      toast.show(`${r.firstName} is in. They can now see the group chat.`);
    });
  }

  function decline(r: JoinRequest) {
    hide(r.participationId, true);
    startTransition(async () => {
      const result = await declineRequest(r.participationId);
      if (result.error) {
        hide(r.participationId, false);
        return toast.show(result.error, "error");
      }
      toast.show(`Declined. ${r.firstName} gets a polite notification.`, "success", {
        durationMs: DECLINE_UNDO_MS,
        onUndo: () =>
          startTransition(async () => {
            const undone = await undoDecline(r.participationId);
            if (undone.error) toast.show(undone.error, "error");
            else hide(r.participationId, false);
          }),
      });
    });
  }

  return (
    <section aria-labelledby="requests-heading">
      <h2 id="requests-heading" className="font-display text-[22px] leading-7 font-bold">
        Requests <span className="text-slate">· {visible.length}</span>
      </h2>
      {visible.length === 0 ? (
        <p className="mt-3 rounded-card border border-border bg-white px-5 py-6 text-[15px] text-slate">
          No requests waiting. People who ask to join show up here.
        </p>
      ) : (
        <ul className="mt-3 flex flex-col gap-3" aria-label="Requests">
          {visible.map((r) => (
            <li key={r.participationId} className="rounded-card border border-border bg-white p-4" data-testid="request-card">
              <Link
                href={`/people/${r.id}?from=activities`}
                className="flex items-center gap-3.5 rounded-input focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              >
                <Avatar id={r.id} name={r.firstName} photoUrl={r.photoUrl} size={48} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[17px] font-bold">
                    {r.age === null ? r.firstName : `${r.firstName}, ${r.age}`}
                  </span>
                  <span className="block text-[14px] text-slate">
                    {[r.connected ? "Connected" : "Not connected", distanceLabel(r.distanceKm), r.sharedInterests.join(", ")]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
              </Link>
              {open && (
                <div className="mt-3.5 grid grid-cols-2 gap-2.5">
                  <Button variant="secondary" size="small" disabled={busy !== null} onClick={() => decline(r)}>
                    Decline
                  </Button>
                  <Button
                    size="small"
                    disabled={full || busy !== null}
                    aria-describedby={full ? "full-note" : undefined}
                    onClick={() => accept(r)}
                  >
                    {busy === r.participationId ? "Accepting…" : "Accept"}
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {full && visible.length > 0 && (
        <p id="full-note" className="mt-2 text-[14px] text-slate">
          It&apos;s full. Accept is off until someone withdraws.
        </p>
      )}
    </section>
  );
}

/** Summary buttons: Group chat, Edit details, Cancel activity (→ S15). */
export function HostActions({
  activityId,
  title,
  editable,
  participantNames,
  waiting,
}: {
  activityId: string;
  title: string;
  editable: boolean;
  participantNames: string[];
  waiting: number;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="mt-6 grid grid-cols-2 gap-2.5">
        <Link href={`/activities/${activityId}/chat`} className={buttonClasses("light")}>
          <MessageSquare size={18} strokeWidth={1.8} aria-hidden="true" />
          Group chat
        </Link>
        {editable && (
          <Link href={`/activities/${activityId}/edit`} className={buttonClasses("secondary")}>
            <Pencil size={18} strokeWidth={1.8} aria-hidden="true" />
            Edit details
          </Link>
        )}
      </div>
      {editable && (
        <button
          type="button"
          aria-haspopup="dialog"
          onClick={() => setOpen(true)}
          className="mx-auto mt-4 flex min-h-11 items-center rounded-full px-4 text-[16px] font-semibold text-danger hover:bg-danger-tint focus-visible:outline-2 focus-visible:outline-blue-600"
        >
          Cancel activity
        </button>
      )}
      <CancelSheet
        open={open}
        onClose={() => setOpen(false)}
        activityId={activityId}
        title={title}
        participantNames={participantNames}
        waiting={waiting}
      />
    </>
  );
}

/** S15: bottom sheet on mobile, dialog from 768 px. */
export function CancelSheet({
  open,
  onClose,
  activityId,
  title,
  participantNames,
  waiting,
}: {
  open: boolean;
  onClose: () => void;
  activityId: string;
  title: string;
  participantNames: string[];
  waiting: number;
}) {
  const toast = useToast();
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  return (
    <Sheet open={open} onClose={onClose} title={`Cancel ${title}?`}>
      <p className="text-[15px] leading-[22px] text-slate">{cancelBody(participantNames, waiting)}</p>
      <div className="mt-4">
        <TextAreaField
          id="cancel-note"
          label="Note to participants"
          placeholder="e.g. Something came up, sorry!"
          rows={3}
          maxLength={CANCEL_NOTE_MAX}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          count={{ value: note.length, max: CANCEL_NOTE_MAX }}
        />
      </div>
      <div className="mt-6 grid grid-cols-2 gap-2.5">
        <Button variant="secondary" onClick={onClose}>
          Keep it
        </Button>
        <Button
          variant="danger"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await cancelActivity(activityId, note);
              if (result.error) return toast.show(result.error, "error");
              onClose();
              toast.show("Activity cancelled. Everyone involved has been told.");
            })
          }
        >
          {pending ? "Cancelling…" : "Cancel activity"}
        </Button>
      </div>
    </Sheet>
  );
}
