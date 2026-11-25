import type { ReactNode } from "react";

/** Side (ST-034): sticky 260 px column + content at lg; stacked below. */
export function Side({ side, children }: { side: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-7 lg:grid lg:grid-cols-[260px_minmax(0,1fr)] lg:items-start lg:gap-10">
      <aside className="lg:sticky lg:top-[108px]">{side}</aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** Grid3 (ST-034): 1 col (14 gap) → 2 col (18) → 3 col (22). Children are <li>s. */
export function Grid3({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <ul aria-label={label} className="grid gap-3.5 md:grid-cols-2 md:gap-[18px] lg:grid-cols-3 lg:gap-[22px]">
      {children}
    </ul>
  );
}
