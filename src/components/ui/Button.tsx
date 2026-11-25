import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "light" | "danger";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-blue-600 text-white hover:bg-blue-700",
  secondary: "bg-white text-charcoal border border-border-input hover:bg-hover",
  light: "bg-light-blue text-blue-700 hover:bg-hover",
  danger: "bg-danger text-white hover:bg-danger-hover",
};

export function buttonClasses(
  variant: ButtonVariant = "primary",
  size: "default" | "small" = "default",
) {
  return [
    "inline-flex w-full items-center justify-center gap-2 rounded-full px-6",
    "text-[15px] font-semibold transition-colors",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600",
    "disabled:cursor-not-allowed disabled:opacity-50",
    size === "small" ? "min-h-11" : "min-h-[52px]",
    variants[variant],
  ].join(" ");
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: "default" | "small";
  leadingIcon?: ReactNode;
};

export function Button({
  variant = "primary",
  size = "default",
  leadingIcon,
  className,
  children,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={[buttonClasses(variant, size), className].filter(Boolean).join(" ")}
      {...props}
    >
      {leadingIcon}
      {children}
    </button>
  );
}
