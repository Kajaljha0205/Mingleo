import type { ReactNode } from "react";

/** Card with round icon, one-line title, one-line help and one action. */
export function EmptyState({
  icon,
  title,
  help,
  action,
}: {
  icon: ReactNode;
  title: string;
  help: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-card border border-border bg-white px-6 py-10 text-center">
      <span className="inline-flex size-16 items-center justify-center rounded-full bg-light-blue text-blue-700">
        {icon}
      </span>
      <h2 className="mt-4 font-display text-[19px] leading-[26px] font-bold">{title}</h2>
      <p className="mt-1.5 max-w-[360px] text-[15px] leading-[22px] text-slate">{help}</p>
      {action && <div className="mt-6 w-full max-w-[280px]">{action}</div>}
    </div>
  );
}
