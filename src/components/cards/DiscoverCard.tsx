import Image from "next/image";
import Link from "next/link";
import { Info, MapPin } from "lucide-react";
import { initials, tintFor } from "@/components/ui/Avatar";
import { InterestChip } from "@/components/ui/Chip";
import { IconLink } from "@/components/ui/IconButton";
import { VerifiedBadge } from "@/components/ui/VerifiedBadge";
import { distanceLabel, plural, profileStatsLine } from "@/lib/format";
import type { Candidate } from "@/server/discover";

/** Discover profile card (§4): 360 px photo + distance chip, name/age, badge, info, shared interests, bio, stats. */
export function DiscoverCard({ person, href, priority = false }: { person: Candidate; href: string; priority?: boolean }) {
  const name = person.age === null ? person.firstName : `${person.firstName}, ${person.age}`;
  const stats = profileStatsLine(person.hostedCount, person.mutual.length);
  return (
    <article
      data-testid="discover-card"
      aria-label={person.firstName}
      className="overflow-hidden rounded-media border border-border bg-white shadow-card-hover"
    >
      <Link
        href={href}
        draggable={false}
        aria-label={`Open ${person.firstName}'s profile`}
        className={`relative block h-[360px] focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-blue-600 ${
          person.photoUrl ? "bg-sand" : tintFor(person.id)
        }`}
      >
        {person.photoUrl ? (
          <Image
            src={person.photoUrl}
            alt=""
            fill
            unoptimized
            priority={priority}
            draggable={false}
            sizes="(min-width: 768px) 480px, 100vw"
            className="object-cover"
          />
        ) : (
          <span aria-hidden="true" className="flex h-full items-center justify-center font-display text-[96px] font-extrabold">
            {initials(person.firstName)}
          </span>
        )}
        <span className="absolute top-4 left-4 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[14px] font-bold text-charcoal">
          <MapPin size={16} strokeWidth={1.8} aria-hidden="true" />
          {distanceLabel(person.distanceKm)} · {person.areaName}
        </span>
      </Link>
      <div className="p-5 md:p-6">
        <div className="flex items-center gap-2">
          <h2 className="font-display text-[26px] leading-8 font-extrabold tracking-[-0.02em]">{name}</h2>
          <VerifiedBadge size={22} />
          <IconLink href={href} label={`About ${person.firstName}`} className="-mr-2 ml-auto text-slate">
            <Info size={22} strokeWidth={1.8} aria-hidden="true" />
          </IconLink>
        </div>
        {person.sharedCount > 0 && (
          <p className="mt-1 text-[15px] font-bold text-blue-700">
            {plural(person.sharedCount, "shared interest", "shared interests")}
          </p>
        )}
        <ul className="mt-3 flex flex-wrap gap-2" aria-label="Interests">
          {person.interests.map((i) => (
            <li key={i.name}>
              <InterestChip name={i.name} shared={i.shared} />
            </li>
          ))}
        </ul>
        {person.bio && <p className="mt-3 text-[16px] leading-6 text-charcoal md:hidden">{person.bio}</p>}
        {stats && <p className="mt-3 text-[15px] text-slate">{stats}</p>}
      </div>
    </article>
  );
}
