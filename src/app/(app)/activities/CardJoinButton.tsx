"use client";

import { useOptimistic, useTransition } from "react";
import { Check, Clock } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import type { ViewerState } from "@/server/activities";
import { requestToJoin } from "./actions";

/** S10 card action: request without opening S11; withdrawing stays on S11. */
export function CardJoinButton({
  activityId,
  title,
  hostName,
  initial,
}: {
  activityId: string;
  title: string;
  hostName: string;
  initial: ViewerState;
}) {
  const toast = useToast();
  // Optimistic only while the request is in flight; afterwards the server's state (props) wins.
  const [state, setState] = useOptimistic<ViewerState>(initial);
  const [pending, startTransition] = useTransition();

  if (state === "requested") {
    return (
      <p className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-sunshine text-[14px] font-semibold text-sunshine-text">
        <Clock size={16} strokeWidth={1.8} aria-hidden="true" />
        Requested · waiting for {hostName}
      </p>
    );
  }
  if (state === "accepted") {
    return (
      <p className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-sage text-[14px] font-bold text-sage-text">
        <Check size={16} strokeWidth={1.8} aria-hidden="true" />
        You&apos;re in
      </p>
    );
  }
  return (
    <Button
      size="small"
      aria-label={`Request to join ${title}`}
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          setState("requested");
          const result = await requestToJoin(activityId);
          if (result.error) return toast.show(result.error, "error");
          toast.show(`Request sent. ${hostName} will let you know.`);
        });
      }}
    >
      Request to join
    </Button>
  );
}
