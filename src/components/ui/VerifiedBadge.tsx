import { BadgeCheck } from "lucide-react";

export const VERIFIED_LABEL = "Google verified";

/** Verified badge; icon-only (with accessible name) or icon + label. */
export function VerifiedBadge({ withLabel = false, size = 20 }: { withLabel?: boolean; size?: number }) {
  return withLabel ? (
    <span className="inline-flex items-center gap-1.5 text-[13px] font-bold text-blue-700">
      <BadgeCheck size={size} strokeWidth={1.8} className="text-mingle-blue" aria-hidden="true" />
      {VERIFIED_LABEL}
    </span>
  ) : (
    <BadgeCheck size={size} strokeWidth={1.8} className="shrink-0 text-mingle-blue" aria-label={VERIFIED_LABEL} role="img" />
  );
}
