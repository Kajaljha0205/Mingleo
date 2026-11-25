import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

const base =
  "inline-flex size-11 shrink-0 items-center justify-center rounded-full text-charcoal transition-colors hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600";

type Common = {
  /** Required: icon-only controls must be named. */
  label: string;
  children: ReactNode;
  bordered?: boolean;
  className?: string;
};

export function IconButton({
  label,
  children,
  bordered = false,
  className = "",
  type = "button",
  ...props
}: Common & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label" | "children">) {
  return (
    <button
      type={type}
      aria-label={label}
      className={`${base} ${bordered ? "border border-border bg-white" : ""} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function IconLink({ label, children, bordered = false, className = "", href }: Common & { href: string }) {
  return (
    <Link href={href} aria-label={label} className={`${base} ${bordered ? "border border-border bg-white" : ""} ${className}`}>
      {children}
    </Link>
  );
}
