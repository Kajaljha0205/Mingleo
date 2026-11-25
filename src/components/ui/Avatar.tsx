import Image from "next/image";

const TINTS = [
  "bg-avatar-blue-bg text-avatar-blue-fg",
  "bg-avatar-sage-bg text-avatar-sage-fg",
  "bg-avatar-sunshine-bg text-avatar-sunshine-fg",
  "bg-avatar-coral-bg text-avatar-coral-fg",
  "bg-avatar-sand-bg text-avatar-sand-fg",
];

const SIZES = { 24: "size-6 text-[10px]", 30: "size-[30px] text-[11px]", 36: "size-9 text-[12px]", 40: "size-10 text-[13px]", 48: "size-12 text-[15px]", 104: "size-[104px] text-[32px]" } as const;
export type AvatarSize = keyof typeof SIZES;

/** Deterministic tint per user id. */
export function tintFor(id: string): string {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return TINTS[h % TINTS.length];
}

export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

type AvatarProps = { id: string; name: string; photoUrl: string | null; size?: AvatarSize; className?: string };

export function Avatar({ id, name, photoUrl, size = 40, className = "" }: AvatarProps) {
  const box = `relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-bold ${SIZES[size]} ${className}`;
  if (photoUrl) {
    return (
      <span className={box}>
        <Image src={photoUrl} alt={name} fill unoptimized sizes={`${size}px`} className="object-cover" />
      </span>
    );
  }
  return (
    <span className={`${box} ${tintFor(id)}`} role="img" aria-label={name}>
      {initials(name)}
    </span>
  );
}

export function AvatarStack({ people, size = 36 }: { people: Omit<AvatarProps, "size">[]; size?: AvatarSize }) {
  return (
    <span className="flex -space-x-2">
      {people.map((p) => (
        <Avatar key={p.id} {...p} size={size} className="ring-2 ring-white" />
      ))}
    </span>
  );
}
