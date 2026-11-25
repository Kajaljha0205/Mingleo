"use client";

import { useState, useTransition } from "react";
import { useToast } from "@/components/ui/Toast";
import { connect, respondToRequest, withdrawRequest } from "@/app/(app)/people/actions";
import type { Relationship } from "@/server/discover";

/** Optimistic connection actions with rollback + error toast (ST-084), shared by S09 and S18. */
export function useRelationship(personId: string, name: string, initial: Relationship) {
  const toast = useToast();
  const [state, setState] = useState<Relationship>(initial);
  const [pending, startTransition] = useTransition();

  function mutate(optimistic: Relationship, run: () => Promise<{ state?: Relationship; error?: string }>, success: string) {
    const previous = state;
    setState(optimistic);
    startTransition(async () => {
      const result = await run();
      if (result.error) {
        setState(previous);
        toast.show(result.error, "error");
        return;
      }
      setState(result.state ?? optimistic);
      toast.show(result.state === "connected" && optimistic !== "connected" ? `You\u2019re now connected with ${name}.` : success);
    });
  }

  return {
    state,
    pending,
    startTransition,
    connect: () => mutate("sent", () => connect(personId), `Request sent. We\u2019ll tell you when ${name} accepts.`),
    withdraw: () => mutate("none", () => withdrawRequest(personId), "Request withdrawn."),
    accept: () => mutate("connected", () => respondToRequest(personId, true), `You\u2019re now connected with ${name}.`),
    decline: () => mutate("none", () => respondToRequest(personId, false), "Request declined."),
  };
}
