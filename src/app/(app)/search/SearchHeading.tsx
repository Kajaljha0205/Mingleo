/** Title + sub (the mobile header carries the title below 768 px). */
export function SearchHeading() {
  return (
    <div className="sr-only md:not-sr-only">
      <h1 className="font-display text-[30px] leading-9 font-extrabold tracking-[-0.02em] lg:text-[40px] lg:leading-[48px]">
        Search
      </h1>
      <p className="mt-1 text-[16px] leading-6 text-slate">Find people and activities with plain filters. No ranking tricks.</p>
    </div>
  );
}

export function SearchSkeleton() {
  return (
    <div aria-busy="true" className="mt-5 md:mt-6">
      <div className="h-[54px] animate-pulse rounded-full bg-hover" />
      <div className="mt-5 h-11 w-full max-w-[640px] animate-pulse rounded-full bg-hover" />
      <div className="mt-8 grid gap-3.5 md:grid-cols-2 md:gap-[18px] lg:grid-cols-3 lg:gap-[22px]">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-[320px] animate-pulse rounded-card bg-hover" />
        ))}
      </div>
    </div>
  );
}
