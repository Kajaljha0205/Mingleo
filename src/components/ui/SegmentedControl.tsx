import Link from "next/link";

export type Segment = { label: string; href: string; current: boolean };

/** Neutral-pill track, white selected segment with blue-700 text (ST-016). Segments are links between views. */
export function SegmentedControl({ label, segments, className = "" }: { label: string; segments: Segment[]; className?: string }) {
  return (
    <nav aria-label={label} className={className}>
      <ul className="flex rounded-full bg-neutral-pill p-1">
        {segments.map((s) => (
          <li key={s.href} className="flex-1">
            <Link
              href={s.href}
              aria-current={s.current ? "page" : undefined}
              className={`flex min-h-11 items-center justify-center rounded-full px-5 text-[16px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
                s.current ? "bg-white text-blue-700 shadow-sm" : "text-charcoal hover:bg-hover"
              }`}
            >
              {s.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
