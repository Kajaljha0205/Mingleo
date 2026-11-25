"use client";

type SwitchProps = {
  id: string;
  name?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  /** false inside grouped cards (S22), where rows are divided instead. */
  bordered?: boolean;
};

/** Labelled 52×32 switch inside a bordered row; submits "on" via a hidden input when checked. */
export function Switch({ id, name, checked, onChange, label, description, bordered = true }: SwitchProps) {
  return (
    <div className={`flex items-center gap-4 px-4 py-3.5 ${bordered ? "rounded-input border border-border" : "md:px-5"}`}>
      <div className="min-w-0 flex-1">
        <p id={`${id}-label`} className="text-[15px] font-bold text-charcoal">
          {label}
        </p>
        {description && (
          <p id={`${id}-desc`} className="text-[14px] text-slate">
            {description}
          </p>
        )}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={`${id}-label`}
        aria-describedby={description ? `${id}-desc` : undefined}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-8 w-[52px] shrink-0 items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
          checked ? "bg-blue-600" : "bg-switch-off"
        }`}
      >
        <span
          aria-hidden="true"
          className={`inline-block size-6 rounded-full bg-white transition-transform ${
            checked ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
      {name && checked && <input type="hidden" name={name} value="on" />}
    </div>
  );
}
