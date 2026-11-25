import type { StatusPillVariant } from "@/components/ui/StatusPill";
import { plural } from "@/lib/format";

type Row = {
  id: string;
  tab: "created" | "joined" | "past";
  myStatus: "host" | "accepted" | "requested" | "closed";
  phase: "open" | "started" | "completed" | "cancelled";
  going: number;
  limit: number;
  hostFirstName: string;
};

/** ST-173 row: link, who line and status pill per tab. Created → S14, Joined → S16 (S11 if requested), Past → S17. */
export function myActivityRow(a: Row): { href: string; who: string; pill: { label: string; variant: StatusPillVariant } } {
  if (a.phase === "cancelled") {
    return {
      href: a.myStatus === "host" ? `/activities/${a.id}/manage` : `/activities/${a.id}?from=profile`,
      who: "Cancelled by host",
      pill: { label: "Cancelled", variant: "cancelled" },
    };
  }
  if (a.tab === "past") {
    return {
      href: `/activities/${a.id}/after`,
      who: `With ${plural(Math.max(0, a.going - 1), "person", "people")}`,
      pill: { label: "Completed", variant: "full" },
    };
  }
  if (a.myStatus === "host") {
    return { href: `/activities/${a.id}/manage`, who: `${a.going} of ${a.limit} going`, pill: { label: "Hosting", variant: "host" } };
  }
  if (a.myStatus === "requested") {
    return { href: `/activities/${a.id}?from=profile`, who: `Hosted by ${a.hostFirstName}`, pill: { label: "Requested", variant: "pending" } };
  }
  return { href: `/activities/${a.id}/chat`, who: `Hosted by ${a.hostFirstName}`, pill: { label: "Going", variant: "positive" } };
}

/** "1 pending request waiting for you" / "18 connections". */
export function connectionsSubline(pending: number, connections: number): string {
  if (pending > 0) return `${plural(pending, "pending request", "pending requests")} waiting for you`;
  return connections > 0 ? plural(connections, "connection", "connections") : "No connections yet";
}
