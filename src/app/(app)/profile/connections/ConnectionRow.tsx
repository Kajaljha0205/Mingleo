"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { MessageSquare } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { removeConnection } from "../../people/actions";

type Person = { id: string; firstName: string; photoUrl: string | null; areaName: string };

/** Name, area, Message, Remove connection (confirm) — ST-085. */
export function ConnectionRow({ person: p }: { person: Person }) {
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);
  const [removed, setRemoved] = useState(false);
  const [pending, startTransition] = useTransition();

  if (removed) return null;
  return (
    <div data-testid="connection-row" className="flex flex-wrap items-center gap-3 px-4 py-3.5 md:flex-nowrap md:px-5">
      <Link
        href={`/people/${p.id}?from=connections`}
        className="flex min-w-0 flex-1 items-center gap-3.5 rounded-input focus-visible:outline-2 focus-visible:outline-blue-600"
      >
        <Avatar id={p.id} name={p.firstName} photoUrl={p.photoUrl} size={48} />
        <span className="min-w-0">
          <span className="block truncate font-display text-[17px] leading-6 font-bold">{p.firstName}</span>
          <span className="block truncate text-[14px] text-slate">{p.areaName}</span>
        </span>
      </Link>
      <div className="flex w-full gap-2 md:w-auto">
        <Link href={`/chats/with/${p.id}`} aria-label={`Message ${p.firstName}`} className={`${buttonClasses("secondary", "small")} flex-1 md:w-auto!`}>
          <MessageSquare size={16} strokeWidth={1.8} aria-hidden="true" />
          Message
        </Link>
        <Button variant="secondary" size="small" className="flex-1 text-danger! md:w-auto!" onClick={() => setConfirm(true)} aria-label={`Remove ${p.firstName}`}>
          Remove
        </Button>
      </div>
      <Sheet open={confirm} onClose={() => setConfirm(false)} title={`Remove ${p.firstName}?`}>
        <p className="text-[15px] leading-[22px] text-slate">
          You&apos;ll no longer be connected and your direct chat ends. {p.firstName} won&apos;t be told.
        </p>
        <div className="mt-6 grid grid-cols-2 gap-2.5">
          <Button variant="secondary" onClick={() => setConfirm(false)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const r = await removeConnection(p.id);
                if (r.error) return toast.show(r.error, "error");
                setConfirm(false);
                setRemoved(true);
                toast.show(`${p.firstName} was removed from your connections.`);
              })
            }
          >
            Remove connection
          </Button>
        </div>
      </Sheet>
    </div>
  );
}
