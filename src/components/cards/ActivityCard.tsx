import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { CalendarDays, MapPin, Users } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { StatusPill } from "@/components/ui/StatusPill";
import { spotsLeftLabel } from "@/lib/activity";
import { distanceLabel } from "@/lib/format";
import { coverFor } from "@/lib/interests";
import { cardDateTime } from "@/lib/time";

/** Interest illustration with the interest chip (and optional status pills) bottom-left. */
export function ActivityCover({
  slug,
  interestName,
  className,
  sizes,
  priority = false,
  chips,
}: {
  slug: string;
  interestName: string;
  className: string;
  sizes: string;
  priority?: boolean;
  chips?: ReactNode;
}) {
  const src = coverFor(slug);
  return (
    <div className={`relative overflow-hidden bg-sand ${className}`}>
      {src && <Image src={src} alt="" fill unoptimized priority={priority} sizes={sizes} className="object-cover" />}
      <div className="absolute bottom-3 left-3 flex flex-wrap gap-2">
        {chips ?? (
          <span className="inline-flex h-8 items-center rounded-full bg-white px-3.5 text-[14px] font-medium text-charcoal">
            {interestName}
          </span>
        )}
      </div>
    </div>
  );
}

export type ActivityCardData = {
  id: string;
  interest: { slug: string; name: string };
  title: string;
  host: { id: string; firstName: string; photoUrl: string | null };
  startsAt: string;
  areaName: string;
  distanceKm: number;
  limit: number;
  going: number;
};

/** ST-018.1: the title link covers the whole card; an optional action (e.g. Request to join) sits above it. */
export function ActivityCard({
  activity: a,
  href,
  muted = false,
  fullLabel = "Full",
  action,
}: {
  activity: ActivityCardData;
  href: string;
  muted?: boolean;
  fullLabel?: string;
  action?: ReactNode;
}) {
  const left = Math.max(0, a.limit - a.going);
  return (
    <article
      data-testid="activity-card"
      className={`group relative flex h-full flex-col overflow-hidden rounded-card border border-border bg-white transition hover:-translate-y-0.5 hover:shadow-card-hover has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-blue-600 ${muted ? "opacity-60" : ""}`}
    >
      <ActivityCover
        slug={a.interest.slug}
        interestName={a.interest.name}
        className="h-[150px]"
        sizes="(min-width: 1024px) 380px, (min-width: 768px) 50vw, 100vw"
      />
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="truncate font-display text-[17px] leading-6 font-bold">
          <Link href={href} className="after:absolute after:inset-0 focus-visible:outline-none">
            {a.title}
          </Link>
        </h3>
        <div className="flex items-center gap-2 text-[14px] text-slate">
          <Avatar id={a.host.id} name={a.host.firstName} photoUrl={a.host.photoUrl} size={24} />
          <span className="min-w-0 flex-1 truncate">Hosted by {a.host.firstName}</span>
          <span className="inline-flex shrink-0 items-center gap-1 font-semibold text-charcoal" aria-label={`${a.going} of ${a.limit} going`}>
            <Users size={16} strokeWidth={1.8} aria-hidden="true" />
            {a.going} / {a.limit}
          </span>
        </div>
        <p className="flex items-center gap-2 text-[14px] text-slate">
          <CalendarDays size={16} strokeWidth={1.8} aria-hidden="true" className="shrink-0" />
          {cardDateTime(new Date(a.startsAt))}
        </p>
        <div className="flex items-center gap-2 text-[14px] text-slate">
          <MapPin size={16} strokeWidth={1.8} aria-hidden="true" className="shrink-0" />
          <span className="min-w-0 flex-1 truncate">
            {a.areaName} · {distanceLabel(a.distanceKm)}
          </span>
          {left === 0 ? <StatusPill variant="full">{fullLabel}</StatusPill> : <StatusPill variant="spots">{spotsLeftLabel(left)}</StatusPill>}
        </div>
        {action && <div className="relative z-10 mt-auto pt-2">{action}</div>}
      </div>
    </article>
  );
}
