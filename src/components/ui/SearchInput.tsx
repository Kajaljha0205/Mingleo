import { Search } from "lucide-react";
import type { InputHTMLAttributes } from "react";

/** 54 px pill search input with icon; 1.5 px blue-600 border when focused or filled (ST-016). */
export function SearchInput({ className = "", ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  return (
    <div className={`relative ${className}`}>
      <Search
        size={20}
        strokeWidth={1.8}
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-5 -translate-y-1/2 text-slate"
      />
      <input
        type="search"
        {...props}
        className="h-[54px] w-full rounded-full border-[1.5px] border-border-input bg-white pr-5 pl-[52px] text-[16px] placeholder:text-slate focus:border-blue-600 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 [&:not(:placeholder-shown)]:border-blue-600"
      />
    </div>
  );
}
