"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

/** Back to wherever the user came from (Inbox opens from every screen); falls back to `href` on a fresh tab. */
export function HistoryBackLink({ href, label }: { href: string; label: string }) {
  const router = useRouter();
  return (
    <Link
      href={href}
      aria-label={label}
      onClick={(e) => {
        if (window.history.length > 1) {
          e.preventDefault();
          router.back();
        }
      }}
      className="inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-border bg-white text-charcoal transition-colors hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
    >
      <ChevronLeft size={22} strokeWidth={1.8} aria-hidden="true" />
    </Link>
  );
}
