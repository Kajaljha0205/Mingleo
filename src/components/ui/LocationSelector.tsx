import Link from "next/link";
import { ChevronDown, MapPin } from "lucide-react";

export const chipLinkBase =
  "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-[15px] font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600";

export const chipLinkIdle = "border-border-input bg-white text-charcoal hover:bg-hover";

export const chipLinkClasses = `${chipLinkBase} ${chipLinkIdle}`;

/** "{area}, {city} · {radius} km" chip that opens S06 in edit mode (city / radius optional per screen). */
export function LocationSelector({
  areaName,
  city,
  radiusKm,
  href,
}: {
  areaName: string;
  city?: string | null;
  radiusKm?: number;
  href: string;
}) {
  const place = city ? `${areaName}, ${city}` : areaName;
  const text = radiusKm === undefined ? place : `${place} · ${radiusKm} km`;
  return (
    <Link href={href} className={chipLinkClasses} aria-label={`Location: ${text.replace(" · ", ", ")}. Change`}>
      <MapPin size={18} strokeWidth={1.8} aria-hidden="true" />
      <span className="truncate">{text}</span>
      <ChevronDown size={18} strokeWidth={1.8} aria-hidden="true" />
    </Link>
  );
}
