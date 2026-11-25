import type { ReactNode } from "react";

const VARIANTS = {
  spots: "bg-sage text-sage-text",
  pending: "bg-sunshine text-sunshine-text",
  positive: "bg-sage text-sage-text",
  full: "bg-neutral-pill text-slate",
  cancelled: "bg-danger-tint text-danger-tint-text",
  host: "bg-light-blue text-blue-700",
} as const;

export type StatusPillVariant = keyof typeof VARIANTS;

/** 24 px status pill (spots left, Pending, Connected, Full, Cancelled, Host). */
export function StatusPill({ variant, children }: { variant: StatusPillVariant; children: ReactNode }) {
  return (
    <span className={`inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-[12px] font-semibold ${VARIANTS[variant]}`}>
      {children}
    </span>
  );
}
