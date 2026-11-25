"use client";

import Link from "next/link";
import { MessageSquare, UserPlus } from "lucide-react";
import { useRelationship } from "@/components/people/useRelationship";
import { Button, buttonClasses } from "@/components/ui/Button";
import type { Relationship } from "@/server/discover";

/** S18 card control: Connect / Pending · tap to withdraw / Connected · message. */
export function ConnectControl({ personId, name, initial }: { personId: string; name: string; initial: Relationship }) {
  const rel = useRelationship(personId, name, initial);

  if (rel.state === "connected") {
    return (
      <Link href={`/chats/with/${personId}`} className={buttonClasses("secondary", "small")} aria-label={`Connected. Message ${name}`}>
        <MessageSquare size={18} strokeWidth={1.8} aria-hidden="true" />
        Connected · message
      </Link>
    );
  }
  if (rel.state === "sent") {
    return (
      <Button
        size="small"
        className="bg-sunshine! text-sunshine-text! hover:brightness-95"
        disabled={rel.pending}
        onClick={rel.withdraw}
        aria-label={`Pending. Withdraw request to ${name}`}
      >
        Pending · tap to withdraw
      </Button>
    );
  }
  // They already asked: Connect accepts (§10).
  return (
    <Button
      size="small"
      disabled={rel.pending}
      onClick={rel.state === "received" ? rel.accept : rel.connect}
      leadingIcon={<UserPlus size={18} strokeWidth={1.8} aria-hidden="true" />}
      aria-label={`Connect with ${name}`}
    >
      Connect
    </Button>
  );
}
