"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

type SheetProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
};

/**
 * Bottom sheet on mobile, centred 520 px dialog from 768 px.
 * Native <dialog> gives the focus trap, Esc-to-close and inert background.
 */
export function Sheet({ open, onClose, title, children }: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const openRef = useRef(open);

  useEffect(() => {
    openRef.current = open;
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={() => {
        // Programmatic closes (open → false) also fire "close"; only Esc should call back.
        if (openRef.current) onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-x-0 top-auto bottom-0 m-0 max-h-[85dvh] w-full max-w-none overflow-y-auto rounded-t-sheet bg-white p-0 text-charcoal backdrop:bg-charcoal/50 md:inset-0 md:m-auto md:max-w-[520px] md:rounded-sheet"
    >
      <div className="px-5 pt-5 pb-[max(24px,env(safe-area-inset-bottom))] md:px-7 md:pt-6 md:pb-7">
        <div className="flex items-center justify-between gap-4">
          <h2 id={titleId} className="font-display text-[19px] leading-[26px] font-bold">
            {title}
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="-mr-2 inline-flex size-11 items-center justify-center rounded-full hover:bg-hover focus-visible:outline-2 focus-visible:outline-blue-600"
          >
            <X size={20} strokeWidth={1.8} aria-hidden="true" />
          </button>
        </div>
        <div className="mt-3">{children}</div>
      </div>
    </dialog>
  );
}
