import Link from "next/link";
import { ChevronLeft } from "lucide-react";

/** "Back to …" text link from tablet up; mobile uses the header's back button (ST-036). */
export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="hidden items-center gap-2 rounded-input text-[16px] font-semibold text-slate hover:text-charcoal focus-visible:outline-2 focus-visible:outline-blue-600 md:inline-flex"
    >
      <ChevronLeft size={20} strokeWidth={1.8} aria-hidden="true" />
      {label}
    </Link>
  );
}
