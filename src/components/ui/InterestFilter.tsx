"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, SlidersHorizontal } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { chipLinkClasses } from "@/components/ui/LocationSelector";

export type InterestOption = { key: string; label: string; href: string; active: boolean };

/** Single filter chip ("All my interests" or the chosen one) → sheet listing the options (S08, S18, S19). */
export function InterestFilter({ options, title }: { options: InterestOption[]; title: string }) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.active && o.key !== "all");
  const label = selected?.label ?? options[0]?.label;

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className={`${chipLinkClasses} ${selected ? "border-blue-600 bg-blue-600 text-white hover:bg-blue-700" : ""}`}
      >
        <SlidersHorizontal size={18} strokeWidth={1.8} aria-hidden="true" />
        {label}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={title}>
        <ul className="flex flex-col">
          {options.map((o) => (
            <li key={o.key} className="border-b border-border last:border-0">
              <Link
                href={o.href}
                scroll={false}
                aria-current={o.active ? "true" : undefined}
                onClick={() => setOpen(false)}
                className={`flex min-h-12 items-center justify-between gap-3 px-1 text-[16px] hover:bg-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-600 ${
                  o.active ? "font-bold text-blue-700" : "text-charcoal"
                }`}
              >
                {o.label}
                {o.active && <Check size={18} strokeWidth={1.8} aria-hidden="true" />}
              </Link>
            </li>
          ))}
        </ul>
      </Sheet>
    </>
  );
}
