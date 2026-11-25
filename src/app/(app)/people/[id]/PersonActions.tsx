"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Ban, Check, Clock, Flag, MessageSquare, MoreHorizontal, UserPlus } from "lucide-react";
import { useRelationship } from "@/components/people/useRelationship";
import { ReportSheet } from "@/components/safety/ReportSheet";
import { Button, buttonClasses } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Sheet } from "@/components/ui/Sheet";
import { StatusPill } from "@/components/ui/StatusPill";
import { useToast } from "@/components/ui/Toast";
import type { Relationship } from "@/server/discover";
import { blockPerson, reportPerson } from "../actions";

type Props = { personId: string; name: string; initial: Relationship; backHref: string };

export function PersonActions({ personId, name, initial, backHref }: Props) {
  const toast = useToast();
  const router = useRouter();
  const rel = useRelationship(personId, name, initial);
  const { state, pending, startTransition } = rel;
  const [sheet, setSheet] = useState<null | "more" | "report" | "block">(null);

  return (
    <>
      <div className="mt-5 flex items-center gap-2.5" data-testid="relationship">
        <div className="flex min-w-0 flex-1 flex-wrap gap-2.5">
          {state === "none" && (
            <Button
              className="flex-1"
              disabled={pending}
              leadingIcon={<UserPlus size={18} strokeWidth={1.8} aria-hidden="true" />}
              onClick={rel.connect}
            >
              Connect
            </Button>
          )}
          {state === "sent" && (
            <>
              <Button
                className="flex-1 bg-sunshine! text-sunshine-text! opacity-100!"
                disabled
                leadingIcon={<Clock size={18} strokeWidth={1.8} aria-hidden="true" />}
              >
                Pending
              </Button>
              <Button
                variant="secondary"
                className="flex-1"
                disabled={pending}
                onClick={rel.withdraw}
              >
                Withdraw
              </Button>
            </>
          )}
          {state === "received" && (
            <>
              <Button
                className="flex-1"
                disabled={pending}
                leadingIcon={<Check size={18} strokeWidth={1.8} aria-hidden="true" />}
                onClick={rel.accept}
              >
                Accept
              </Button>
              <Button
                variant="secondary"
                className="flex-1"
                disabled={pending}
                onClick={rel.decline}
              >
                Decline
              </Button>
            </>
          )}
          {state === "connected" && (
            <div className="flex flex-1 items-center gap-3">
              <StatusPill variant="positive">
                <Check size={14} strokeWidth={1.8} aria-hidden="true" />
                Connected
              </StatusPill>
              <Link href={`/chats/with/${personId}`} className={`${buttonClasses("secondary")} flex-1`}>
                <MessageSquare size={18} strokeWidth={1.8} aria-hidden="true" />
                Message
              </Link>
            </div>
          )}
        </div>
        <IconButton label="More: report or block" bordered className="size-[52px]" onClick={() => setSheet("more")}>
          <MoreHorizontal size={22} strokeWidth={1.8} aria-hidden="true" />
        </IconButton>
      </div>

      <Sheet open={sheet === "more"} onClose={() => setSheet(null)} title={name}>
        <div className="flex flex-col gap-2.5">
          <Button variant="secondary" leadingIcon={<Flag size={18} strokeWidth={1.8} aria-hidden="true" />} onClick={() => setSheet("report")}>
            Report {name}
          </Button>
          <Button variant="secondary" className="text-danger!" leadingIcon={<Ban size={18} strokeWidth={1.8} aria-hidden="true" />} onClick={() => setSheet("block")}>
            Block {name}
          </Button>
        </div>
      </Sheet>

      <ReportSheet
        open={sheet === "report"}
        onClose={() => setSheet(null)}
        title={`Report ${name}`}
        submit={(reason, note) => reportPerson(personId, reason, note)}
        onDone={() => {
          setSheet(null);
          toast.show("Thanks. We\u2019ll review your report.");
        }}
      />

      <Sheet open={sheet === "block"} onClose={() => setSheet(null)} title={`Block ${name}?`}>
        <p className="text-[15px] leading-[22px] text-slate">
          You won&apos;t see each other anywhere on Mingleo, and any connection or pending request between you is
          removed. {name} won&apos;t be told.
        </p>
        <div className="mt-6 grid grid-cols-2 gap-2.5">
          <Button variant="secondary" onClick={() => setSheet(null)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await blockPerson(personId);
                if (result.error) return toast.show(result.error, "error");
                setSheet(null);
                toast.show(`${name} is blocked.`);
                router.push(backHref);
              })
            }
          >
            Block
          </Button>
        </div>
      </Sheet>
    </>
  );
}
