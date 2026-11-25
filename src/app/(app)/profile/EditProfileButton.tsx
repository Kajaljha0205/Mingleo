"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronRight, Pencil } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";

const PARTS = [
  { href: "/edit/about", label: "Name, birthday and bio" },
  { href: "/edit/photo", label: "Photo" },
  { href: "/edit/interests", label: "Interests" },
  { href: "/location?from=profile", label: "Location" },
];

/** Edit profile → pick which S03–S06 form to open in edit mode (Q-60). */
export function EditProfileButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="secondary"
        size="small"
        aria-haspopup="dialog"
        leadingIcon={<Pencil size={16} strokeWidth={1.8} aria-hidden="true" />}
        onClick={() => setOpen(true)}
        className="gap-1.5! px-2! text-[14px]! whitespace-nowrap"
      >
        Edit profile
      </Button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Edit profile">
        <ul className="flex flex-col">
          {PARTS.map((p) => (
            <li key={p.href} className="border-b border-border last:border-0">
              <Link
                href={p.href}
                onClick={() => setOpen(false)}
                className="flex min-h-12 items-center justify-between gap-3 px-1 text-[16px] hover:bg-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-600"
              >
                {p.label}
                <ChevronRight size={18} strokeWidth={1.8} aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      </Sheet>
    </>
  );
}
