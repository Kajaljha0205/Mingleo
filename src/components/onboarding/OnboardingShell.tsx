import Link from "next/link";
import type { ReactNode } from "react";
import { Check, ChevronLeft, LogOut } from "lucide-react";
import { signOut } from "@/app/auth/actions";
import { Wordmark } from "@/components/ui/Wordmark";
import { ONBOARDING_STEPS } from "@/lib/onboarding";

type OnboardingShellProps = {
  /** Current step 1–5; omit on S01 (no progress, wordmark shown instead). */
  step?: number;
  backHref?: string;
  /** Edit mode (ST-203): back to origin, no progress or step list. */
  edit?: { backHref: string; backLabel: string };
  children: ReactNode;
};

export function OnboardingShell({ step, backHref, edit, children }: OnboardingShellProps) {
  const total = ONBOARDING_STEPS.length;

  return (
    <div className="flex min-h-dvh flex-1 bg-ivory">
      <BrandPanel step={step} showSteps={!edit} />

      <main className="flex min-w-0 flex-1 flex-col md:items-center md:justify-center md:px-8 md:py-14">
        <div
          data-testid="onboarding-card"
          className="flex w-full flex-1 flex-col md:max-w-[560px] md:flex-none md:rounded-sheet md:border md:border-border md:bg-white md:p-10 md:shadow-onboarding"
        >
          {edit && (
            <div className="px-5 pt-3.5 md:p-0">
              <Link
                href={edit.backHref}
                aria-label={edit.backLabel}
                className="inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-border bg-white hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              >
                <ChevronLeft size={22} strokeWidth={1.8} aria-hidden="true" />
              </Link>
            </div>
          )}
          {step !== undefined && (
            <div className="flex items-center gap-3 px-5 pt-3.5 md:p-0">
              {backHref ? (
                <Link
                  href={backHref}
                  aria-label="Back"
                  className="inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-border bg-white hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                >
                  <ChevronLeft size={22} strokeWidth={1.8} aria-hidden="true" />
                </Link>
              ) : (
                // Q-27: first step has no Back, so offer Sign out in its place.
                <form action={signOut}>
                  <button
                    type="submit"
                    aria-label="Sign out"
                    title="Sign out"
                    className="inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-border bg-white hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                  >
                    <LogOut size={20} strokeWidth={1.8} aria-hidden="true" />
                  </button>
                </form>
              )}
              <div
                role="progressbar"
                aria-label="Sign-up progress"
                aria-valuemin={1}
                aria-valuemax={total}
                aria-valuenow={step}
                className="flex flex-1 gap-1.5"
              >
                {ONBOARDING_STEPS.map((s, i) => (
                  <span
                    key={s.key}
                    className={`h-1 flex-1 rounded-full ${i < step ? "bg-blue-600" : "bg-border"}`}
                  />
                ))}
              </div>
              <span className="text-[13px] font-bold text-slate">
                {step}/{total}
              </span>
            </div>
          )}

          <div className="flex flex-1 flex-col px-5 pt-6 md:p-0 md:pt-0">
            {step === undefined && !edit && (
              <div className="lg:hidden">
                <Wordmark />
              </div>
            )}
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}

/** Primary actions: sticky bottom bar on mobile, inline at the end of the card from md. */
export function OnboardingActions({ children }: { children: ReactNode }) {
  return (
    <div
      data-testid="onboarding-actions"
      className="sticky bottom-0 -mx-5 mt-auto bg-ivory px-5 pt-3 pb-[max(24px,env(safe-area-inset-bottom))] md:static md:mx-0 md:bg-transparent md:p-0 md:pt-10"
    >
      {children}
    </div>
  );
}

export function StepHeading({ title, help }: { title: string; help: string }) {
  return (
    <div className="mt-6 md:mt-8">
      <h1 className="font-display text-[26px] leading-8 font-extrabold tracking-[-0.02em] md:text-[30px] md:leading-9 lg:text-[36px] lg:leading-[42px]">
        {title}
      </h1>
      <p className="mt-2 text-[16px] leading-6 text-slate">{help}</p>
    </div>
  );
}

export function StepSkeleton() {
  return <div aria-busy="true" className="mt-6 h-64 animate-pulse rounded-card bg-hover" />;
}

function BrandPanel({ step, showSteps }: { step?: number; showSteps: boolean }) {
  return (
    <aside
      data-testid="brand-panel"
      className="sticky top-0 hidden h-dvh w-[42%] max-w-[580px] shrink-0 flex-col bg-charcoal p-14 text-white lg:flex"
    >
      <Wordmark tone="light" />

      <div className="my-auto py-10">
        <p className="font-display text-[44px] leading-[48px] font-extrabold tracking-[-0.02em]">
          Real people.
          <br />
          Real plans.
        </p>
        <p className="mt-6 max-w-[380px] text-[17px] leading-[27px] text-white/80">
          Find people nearby who share your interests, and do things together in the real
          world.
        </p>

        {showSteps && <ol className="mt-8 flex flex-col gap-3.5" aria-label="Sign-up steps">
          {ONBOARDING_STEPS.map((s, i) => {
            const n = i + 1;
            const done = step !== undefined && n < step;
            const current = step === n;
            return (
              <li
                key={s.key}
                className={`flex items-center gap-4 text-[17px] ${current ? "font-bold" : ""}`}
                aria-current={current ? "step" : undefined}
              >
                <span
                  className={`inline-flex size-7 items-center justify-center rounded-full text-[13px] font-bold ${
                    done
                      ? "bg-white/15"
                      : current
                        ? "bg-blue-600"
                        : "border border-white/30"
                  }`}
                >
                  {done ? <Check size={14} strokeWidth={1.8} aria-label="Completed" /> : n}
                </span>
                {s.label}
              </li>
            );
          })}
        </ol>}
      </div>

      <p className="text-[14px] text-white/70">Piloting in Bengaluru</p>
    </aside>
  );
}
