"use client";

import { useRouter } from "next/navigation";
import { CalendarDays } from "lucide-react";

/** Calendar chip for dates beyond the day chips (§9 S19); native date picker bound to ?date=. */
export function DatePickerChip({
  value,
  min,
  label,
  baseHref,
}: {
  value: string | null;
  min: string;
  label: string;
  /** Current search URL without ?date=. */
  baseHref: string;
}) {
  const router = useRouter();
  const active = value !== null;
  return (
    <label
      className={`relative inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-2 rounded-full border px-4 text-[15px] font-semibold transition-colors has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-blue-600 ${
        active ? "border-blue-600 bg-blue-600 text-white" : "border-border-input bg-white text-charcoal hover:bg-hover"
      }`}
    >
      <CalendarDays size={18} strokeWidth={1.8} aria-hidden="true" />
      <span aria-hidden="true">{label}</span>
      <input
        type="date"
        aria-label={active ? `Date: ${label}. Pick another date` : "Pick a date"}
        min={min}
        value={value ?? ""}
        onClick={(e) => {
          try {
            e.currentTarget.showPicker();
          } catch {
            // Older browsers open their own picker on focus.
          }
        }}
        onChange={(e) => {
          const d = e.target.value;
          if (!d) return;
          router.replace(`${baseHref}${baseHref.includes("?") ? "&" : "?"}date=${d}`, { scroll: false });
        }}
        className="absolute inset-0 size-full cursor-pointer opacity-0"
      />
    </label>
  );
}
