import { Suspense } from "react";
import { Users } from "lucide-react";
import { MobileHeader, PageContainer } from "@/components/app/AppShell";
import { BackLink } from "@/components/ui/BackLink";
import { EmptyState } from "@/components/ui/EmptyState";
import { plural } from "@/lib/format";
import { loadMyConnections } from "@/server/me";
import { requireOnboarded } from "@/server/profile";
import { ConnectionRequestCard } from "../../inbox/ConnectionRequestCard";
import { ConnectionRow } from "./ConnectionRow";

/** S21-C Connections list (ST-085; not drawn in V4 — Q-61). */
export default function ConnectionsPage() {
  return (
    <>
      <MobileHeader title="My connections" back={{ href: "/profile", label: "Back to Profile" }} />
      <PageContainer>
        <div className="mx-auto w-full max-w-[760px]">
          <BackLink href="/profile" label="Back to Profile" />
          <h1 className="sr-only font-display text-[30px] leading-9 font-extrabold tracking-[-0.02em] md:not-sr-only md:mt-4 md:block">
            My connections
          </h1>
          <Suspense fallback={<div aria-busy="true" className="mt-6 h-[320px] animate-pulse rounded-card bg-hover" />}>
            <Connections />
          </Suspense>
        </div>
      </PageContainer>
    </>
  );
}

async function Connections() {
  const { supabase } = await requireOnboarded();
  const { pending, connections } = await loadMyConnections(supabase);
  return (
    <>
      {pending.length > 0 && (
        <section aria-labelledby="pending-heading">
          <h2 id="pending-heading" className="mt-6 mb-3 text-[13px] font-bold tracking-[0.08em] text-slate uppercase">
            Waiting for you
          </h2>
          <ul className="flex flex-col gap-3">
            {pending.map((p) => (
              <li key={p.id}>
                <ConnectionRequestCard actor={{ ...p, connected: false }} />
              </li>
            ))}
          </ul>
        </section>
      )}
      <section aria-labelledby="connections-heading">
        <h2 id="connections-heading" className="mt-7 mb-3 text-[13px] font-bold tracking-[0.08em] text-slate uppercase">
          {plural(connections.length, "connection", "connections")}
        </h2>
        {connections.length ? (
          <ul className="overflow-hidden rounded-card border border-border bg-white">
            {connections.map((c) => (
              <li key={c.id} className="border-b border-border last:border-0">
                <ConnectionRow person={c} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={<Users size={28} strokeWidth={1.8} aria-hidden="true" />}
            title="No connections yet"
            help="Connect with people on Discover, or after an activity together."
          />
        )}
      </section>
    </>
  );
}
