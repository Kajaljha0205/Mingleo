import { Check } from "lucide-react";
import type { ButtonHTMLAttributes } from "react";

type ChipProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> & {
  selected: boolean;
};

/** Toggle chip (filters, interests, radius, dates). */
export function Chip({ selected, children, className = "", ...props }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-[15px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
        selected
          ? "border-blue-600 bg-blue-600 text-white"
          : "border-border-input bg-white text-charcoal hover:bg-hover"
      } ${className}`}
      {...props}
    >
      {selected && <Check size={16} strokeWidth={1.8} aria-hidden="true" />}
      {children}
    </button>
  );
}

/** Read-only interest chip; light-blue when shared with the viewer. */
export function InterestChip({ name, shared = false }: { name: string; shared?: boolean }) {
  return (
    <span
      className={`inline-flex min-h-8 items-center rounded-full border px-3.5 text-[14px] font-medium ${
        shared ? "border-light-blue bg-light-blue text-blue-700" : "border-border-input bg-white text-charcoal"
      }`}
    >
      {name}
    </span>
  );
}
