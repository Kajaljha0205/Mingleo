"use client";

import { useState, useTransition } from "react";
import { OnboardingActions } from "@/components/onboarding/OnboardingShell";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { MIN_INTERESTS } from "@/lib/onboarding";
import type { Interest } from "@/server/profile";
import { saveInterests } from "../actions";

type Props = { interests: Interest[]; initialSelected: number[]; from?: string; saveLabel?: string };

export function InterestsStep({ interests, initialSelected, from, saveLabel = "Continue" }: Props) {
  const [selected, setSelected] = useState<number[]>(initialSelected);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const remaining = MIN_INTERESTS - selected.length;

  function toggle(id: number) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  function save() {
    startTransition(async () => {
      const result = await saveInterests(selected, from);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="flex flex-1 flex-col">
      <ul className="mt-6 flex flex-wrap gap-2.5" aria-label="Interests">
        {interests.map((i) => (
          <li key={i.id}>
            <Chip selected={selected.includes(i.id)} onClick={() => toggle(i.id)}>
              {i.name}
            </Chip>
          </li>
        ))}
      </ul>
      {error && (
        <p role="alert" className="mt-4 text-[14px] font-semibold text-danger">
          {error}
        </p>
      )}
      <OnboardingActions>
        <div className="mb-3 flex items-center justify-between text-[15px]" aria-live="polite">
          <span className="font-bold text-charcoal">{selected.length} selected</span>
          {remaining > 0 ? (
            <span className="font-semibold text-sunshine-text">Pick {remaining} more</span>
          ) : (
            <span className="font-semibold text-sage-text">Great, that&apos;s enough</span>
          )}
        </div>
        <Button disabled={remaining > 0 || pending} onClick={save}>
          {pending ? "Saving…" : saveLabel}
        </Button>
      </OnboardingActions>
    </div>
  );
}
