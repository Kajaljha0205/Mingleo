import Link from "next/link";
import type { MouseEvent, ReactNode } from "react";

export type FilterChipItem = { key: string; label: string; href: string; active: boolean; icon?: ReactNode };

/** Single-select chip links bound to the URL; scroll on mobile, wrap from 768 px. Optional onSelect lets a client page filter instantly. */
export function FilterChips({
  label,
  items,
  trailing,
  className = "",
  onSelect,
}: {
  label: string;
  items: FilterChipItem[];
  trailing?: ReactNode;
  className?: string;
  onSelect?: (e: MouseEvent<HTMLAnchorElement>, href: string) => void;
}) {
  return (
    <nav aria-label={label} className={className}>
      <ul className="-mx-4 flex gap-2.5 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:flex-wrap md:overflow-visible md:px-0">
        {items.map((o) => (
          <li key={o.key} className="shrink-0">
            <Link
              href={o.href}
              scroll={false}
              aria-current={o.active ? "true" : undefined}
              onClick={onSelect ? (e) => onSelect(e, o.href) : undefined}
              className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-[15px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
                o.active ? "border-blue-600 bg-blue-600 text-white" : "border-border-input bg-white text-charcoal hover:bg-hover"
              }`}
            >
              {o.icon}
              {o.label}
            </Link>
          </li>
        ))}
        {trailing && <li className="shrink-0">{trailing}</li>}
      </ul>
    </nav>
  );
}
