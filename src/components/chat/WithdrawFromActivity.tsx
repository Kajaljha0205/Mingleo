"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useToast } from "@/components/ui/Toast";
import { withdrawFromActivity } from "@/app/(app)/activities/actions";

/** Participants only: frees a spot, notifies the host and removes chat access (ST-104.3). */
export function WithdrawFromActivity({ activityId, hostName }: { activityId: string; hostName: string }) {
  const toast = useToast();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await withdrawFromActivity(activityId);
          if (result.error) return toast.show(result.error, "error");
          toast.show(`You've left. ${hostName} has been told.`);
          router.push(`/activities/${activityId}`);
        })
      }
      className="mx-auto flex min-h-11 items-center rounded-full px-4 text-[16px] font-semibold text-danger hover:bg-danger-tint focus-visible:outline-2 focus-visible:outline-blue-600 disabled:opacity-50"
    >
      {pending ? "Leaving…" : "Withdraw from activity"}
    </button>
  );
}
