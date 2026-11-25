"use client";

import { useActionState } from "react";
import { OnboardingActions } from "@/components/onboarding/OnboardingShell";
import { Button } from "@/components/ui/Button";
import { completeOnboarding } from "../actions";

export function CompleteButton() {
  const [state, action, pending] = useActionState(async () => completeOnboarding(), null);
  return (
    <OnboardingActions>
      {state?.error && (
        <p role="alert" className="mb-3 text-[14px] font-semibold text-danger">
          {state.error}
        </p>
      )}
      <form action={action}>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Looks good, let\u2019s go"}
        </Button>
      </form>
    </OnboardingActions>
  );
}
