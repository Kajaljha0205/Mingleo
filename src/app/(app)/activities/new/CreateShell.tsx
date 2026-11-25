import type { ReactNode } from "react";
import { BackLink } from "@/components/ui/BackLink";

/** S12/S13 frame: back link + step label, heading, form beside a sticky preview, actions. */
export function CreateShell({
  back,
  step,
  title,
  form,
  preview,
  actions,
}: {
  back: { href: string; label: string };
  step?: string;
  title: string;
  form: ReactNode;
  preview: ReactNode;
  actions: ReactNode;
}) {
  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <BackLink href={back.href} label={back.label} />
        {step && <p className="text-[13px] font-bold tracking-[0.08em] text-slate uppercase md:ml-auto">{step}</p>}
      </div>
      <div className="mt-2 grid gap-7 md:mt-5 lg:grid-cols-[1.4fr_1fr] lg:gap-12">
        <div className="min-w-0">
          <h1 className="font-display text-[30px] leading-9 font-extrabold tracking-[-0.02em] lg:text-[44px] lg:leading-[52px]">
            {title}
          </h1>
          <div className="mt-6">{form}</div>
        </div>
        <aside aria-label="Preview" className="min-w-0 lg:sticky lg:top-[108px] lg:self-start lg:pt-[68px]">
          <h2 className="mb-3 text-[13px] font-bold tracking-[0.08em] text-slate uppercase">Preview</h2>
          {preview}
        </aside>
      </div>
      {/* Mobile: fixed above the safe area (the bottom bar is hidden during create steps). */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-white px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] md:static md:mt-10 md:border-0 md:bg-transparent md:p-0">
        <div className="mx-auto flex max-w-[1240px] gap-2.5 md:justify-end [&>*]:flex-1 md:[&>*]:w-auto md:[&>*]:flex-none md:[&>*]:px-8">
          {actions}
        </div>
      </div>
    </>
  );
}
