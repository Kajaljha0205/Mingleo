import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { MapPin } from "lucide-react";
import { initials, tintFor } from "@/components/ui/Avatar";
import { InterestChip } from "@/components/ui/Chip";
import { distanceLabel } from "@/lib/format";

export type PersonCardData = {
  id: string;
  firstName: string;
  age: number | null;
  photoUrl: string | null;
  areaName: string;
  distanceKm: number;
  interests: { name: string; shared: boolean }[];
};

/** ST-018.3 search result: 170 px photo or initials + distance chip, name/age, side label, interests, control. */
export function PersonCard({
  person: p,
  href,
  label,
  action,
}: {
  person: PersonCardData;
  href: string;
  label: string;
  action: ReactNode;
}) {
  const name = p.age === null ? p.firstName : `${p.firstName}, ${p.age}`;
  return (
    <article
      data-testid="person-card"
      className="relative flex h-full flex-col overflow-hidden rounded-card border border-border bg-white transition hover:-translate-y-0.5 hover:shadow-card-hover has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-blue-600"
    >
      <div className={`relative h-[170px] ${p.photoUrl ? "bg-sand" : tintFor(p.id)}`}>
        {p.photoUrl ? (
          <Image src={p.photoUrl} alt="" fill unoptimized sizes="(min-width: 1024px) 380px, (min-width: 768px) 50vw, 100vw" className="object-cover" />
        ) : (
          <span aria-hidden="true" className="flex h-full items-center justify-center font-display text-[64px] font-extrabold">
            {initials(p.firstName)}
          </span>
        )}
        <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[13px] font-bold text-charcoal">
          <MapPin size={14} strokeWidth={1.8} aria-hidden="true" />
          {distanceLabel(p.distanceKm)} · {p.areaName}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="min-w-0 truncate font-display text-[18px] leading-6 font-bold">
            <Link href={href} className="after:absolute after:inset-0 focus-visible:outline-none">
              {name}
            </Link>
          </h3>
          <span className="shrink-0 text-[13px] text-slate">{label}</span>
        </div>
        {p.interests.length > 0 && (
          <ul className="flex flex-wrap gap-2" aria-label="Interests">
            {p.interests.map((i) => (
              <li key={i.name}>
                <InterestChip name={i.name} shared={i.shared} />
              </li>
            ))}
          </ul>
        )}
        <div className="relative z-10 mt-auto pt-1">{action}</div>
      </div>
    </article>
  );
}
