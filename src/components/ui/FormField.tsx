import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";

const control =
  "w-full rounded-input border bg-white px-4 text-[16px] font-medium text-charcoal placeholder:font-normal placeholder:text-slate focus:border-blue-600 focus:outline-[1.5px] focus:-outline-offset-1 focus:outline-blue-600";

type FieldProps = {
  id: string;
  label: string;
  error?: string;
  /** Shows "n / max" under the field. */
  count?: { value: number; max: number };
};

function FieldFrame({
  id,
  label,
  error,
  count,
  children,
}: FieldProps & { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-[13px] font-bold text-charcoal">
        {label}
      </label>
      {children}
      {(error || count) && (
        <div className="flex items-start gap-3 text-[13px]">
          {error && (
            <p id={`${id}-error`} className="font-semibold text-danger">
              {error}
            </p>
          )}
          {count && (
            <p id={`${id}-count`} className="ml-auto text-slate" aria-live="polite">
              {count.value} / {count.max}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function describedBy(id: string, error?: string, count?: FieldProps["count"]) {
  return [error && `${id}-error`, count && `${id}-count`].filter(Boolean).join(" ") || undefined;
}

export function TextField({
  id,
  label,
  error,
  count,
  className = "",
  ...props
}: FieldProps & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <FieldFrame id={id} label={label} error={error} count={count}>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, count)}
        className={`${control} h-[54px] ${error ? "border-danger" : "border-border-input"} ${className}`}
        {...props}
      />
    </FieldFrame>
  );
}

export function TextAreaField({
  id,
  label,
  error,
  count,
  className = "",
  ...props
}: FieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <FieldFrame id={id} label={label} error={error} count={count}>
      <textarea
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, count)}
        className={`${control} min-h-[96px] resize-none py-3.5 leading-[22px] ${error ? "border-danger" : "border-border-input"} ${className}`}
        {...props}
      />
    </FieldFrame>
  );
}
