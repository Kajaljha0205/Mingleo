"use client";

import { useSearchParams } from "next/navigation";

export function AccountDeletedNotice() {
  if (useSearchParams().get("account") !== "deleted") return null;
  return (
    <p
      role="status"
      className="mt-4 rounded-input bg-danger-tint px-4 py-3 text-[14px] font-semibold text-danger-tint-text lg:mt-0 lg:mb-5"
    >
      Your account has been deleted. You need to be 18 or older to use Mingleo.
    </p>
  );
}
