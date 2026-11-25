"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { currentSection, hidesBottomBar, NAV } from "./nav";

export function TopNavLinks() {
  return <TopNavList current={currentSection(usePathname())} />;
}

export function BottomBar() {
  const pathname = usePathname();
  if (hidesBottomBar(pathname)) return null;
  return <BottomBarList current={currentSection(pathname)} />;
}

/** Pathname-free render used as the Suspense fallback while the route streams. */
export function TopNavList({ current }: { current?: string }) {
  return (
    <ul className="flex items-center gap-1">
      {NAV.map(({ key, label, href, icon: Icon }) => {
        const active = key === current;
        return (
          <li key={key}>
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              className={`inline-flex h-11 items-center gap-2 rounded-full px-3.5 text-[15px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 lg:px-4 ${
                active ? "bg-light-blue font-bold text-blue-700" : "font-medium text-charcoal hover:bg-hover"
              }`}
            >
              <Icon size={20} strokeWidth={1.8} aria-hidden="true" />
              {label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function BottomBarList({ current }: { current?: string }) {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-white pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="grid grid-cols-4">
        {NAV.map(({ key, label, href, icon: Icon }) => {
          const active = key === current;
          return (
            <li key={key}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className="flex min-h-[68px] flex-col items-center justify-center gap-1 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-600"
              >
                <span
                  className={`inline-flex h-8 w-14 items-center justify-center rounded-full ${
                    active ? "bg-light-blue text-blue-700" : "text-slate"
                  }`}
                >
                  <Icon size={22} strokeWidth={1.8} aria-hidden="true" />
                </span>
                <span className={`text-[12px] ${active ? "font-bold text-blue-700" : "font-medium text-slate"}`}>
                  {label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
