"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { SearchInput } from "@/components/ui/SearchInput";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { QUERY_MAX, SEARCH_DEBOUNCE_MS, searchHref } from "@/lib/search";

const MODES = {
  people: { path: "/search/people", label: "People", placeholder: "Name or interest, e.g. poker" },
  activities: { path: "/search/activities", label: "Activities", placeholder: "Activity name, e.g. doubles" },
} as const;

type Mode = keyof typeof MODES;

/** Search input (filters as you type, 300 ms) + People | Activities; each tab starts its own search (Q-57). */
export function SearchBar({ mode }: { mode: Mode }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const current = pathname === MODES[mode].path;
  const urlQuery = params.get("q") ?? "";
  const [value, setValue] = useState(urlQuery);
  // Query we sent that hasn't come back in the URL yet (so typing ahead isn't overwritten).
  const [pushed, setPushed] = useState<string | null>(null);
  const [seen, setSeen] = useState(urlQuery);
  // Hidden kept-alive pages see other routes' params; only sync while this page is the current route.
  if (current && urlQuery !== seen) {
    setSeen(urlQuery);
    if (urlQuery === pushed) setPushed(null);
    else setValue(urlQuery);
  }

  const push = useCallback(
    (v: string) => {
      setPushed(v);
      router.replace(searchHref(pathname, Object.fromEntries(params), { q: v }), { scroll: false });
    },
    [router, pathname, params],
  );

  useEffect(() => {
    if (!current || value.trim() === urlQuery) return;
    const t = setTimeout(() => push(value.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [current, value, urlQuery, push]);

  return (
    <div className="mt-5 flex flex-col gap-4 md:mt-6 md:flex-row md:items-center">
      <form
        role="search"
        className="min-w-0 flex-1"
        onSubmit={(e) => {
          e.preventDefault();
          if (value.trim() !== urlQuery) push(value.trim());
        }}
      >
        <label htmlFor="search-input" className="sr-only">
          {mode === "people" ? "Search people" : "Search activities"}
        </label>
        <SearchInput
          id="search-input"
          placeholder={MODES[mode].placeholder}
          maxLength={QUERY_MAX}
          autoComplete="off"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      </form>
      <SegmentedControl
        label="Search for"
        className="w-full max-w-[380px] md:w-[400px] md:shrink-0"
        segments={(Object.keys(MODES) as Mode[]).map((m) => ({
          label: MODES[m].label,
          href: MODES[m].path,
          current: m === mode,
        }))}
      />
    </div>
  );
}
