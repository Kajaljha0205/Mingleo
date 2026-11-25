import Image from "next/image";
import Link from "next/link";
import { BadgeCheck, MapPin, Pencil } from "lucide-react";
import { InterestChip } from "@/components/ui/Chip";

type ProfileCardProps = {
  photoUrl: string | null;
  name: string;
  /** null when the person hides their age. */
  age: number | null;
  verifiedLabel: string;
  areaName: string;
  radiusKm: number;
  bio: string | null;
  interests: string[];
  editPhotoHref?: string;
};

/** Profile card as others see it (S07 preview; Discover variant extends this in ST-018). */
export function ProfileCard({
  photoUrl,
  name,
  age,
  verifiedLabel,
  areaName,
  radiusKm,
  bio,
  interests,
  editPhotoHref,
}: ProfileCardProps) {
  return (
    <article
      data-testid="profile-card"
      className="overflow-hidden rounded-card border border-border bg-white"
    >
      <div className="relative h-[360px] bg-sand">
        {photoUrl && (
          <Image
            src={photoUrl}
            alt={`Photo of ${name}`}
            fill
            unoptimized
            sizes="(min-width: 768px) 480px, 100vw"
            className="object-cover"
          />
        )}
        {editPhotoHref && (
          <Link
            href={editPhotoHref}
            aria-label="Change photo"
            className="absolute right-3 bottom-3 inline-flex size-11 items-center justify-center rounded-full bg-white text-charcoal hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            <Pencil size={18} strokeWidth={1.8} aria-hidden="true" />
          </Link>
        )}
      </div>
      <div className="flex flex-col gap-3 p-5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h2 className="font-display text-[22px] leading-7 font-extrabold tracking-[-0.01em]">
            {age === null ? name : `${name}, ${age}`}
          </h2>
          <span className="inline-flex items-center gap-1.5 text-[13px] font-bold text-blue-700">
            <BadgeCheck size={18} strokeWidth={1.8} className="text-mingle-blue" aria-hidden="true" />
            {verifiedLabel}
          </span>
        </div>
        <p className="flex items-center gap-2 text-[15px] text-slate">
          <MapPin size={16} strokeWidth={1.8} aria-hidden="true" />
          {areaName} · discovering within {radiusKm} km
        </p>
        {bio && <p className="text-[15px] leading-[22px] text-charcoal">{bio}</p>}
        {interests.length > 0 && (
          <ul className="flex flex-wrap gap-2" aria-label="Interests">
            {interests.map((i) => (
              <li key={i}>
                <InterestChip name={i} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </article>
  );
}
