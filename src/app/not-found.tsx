import Link from "next/link";
import { SearchX } from "lucide-react";
import { buttonClasses } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

/** Friendly 404; also used for blocked or hidden people so their existence isn't revealed. */
export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-[560px] flex-1 flex-col justify-center px-4 py-14">
      <EmptyState
        icon={<SearchX size={28} strokeWidth={1.8} aria-hidden="true" />}
        title="We couldn’t find that"
        help="It may have been removed, or the link is wrong."
        action={
          <Link href="/discover" className={buttonClasses("secondary")}>
            Go to Discover
          </Link>
        }
      />
    </main>
  );
}
