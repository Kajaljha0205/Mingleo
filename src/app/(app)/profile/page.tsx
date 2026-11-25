import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronRight, MapPin, Settings } from "lucide-react";
import { MobileHeader, PageContainer } from "@/components/app/AppShell";
import { ActivityCover } from "@/components/cards/ActivityCard";
import { AvatarStack, initials, tintFor } from "@/components/ui/Avatar";
import { buttonClasses } from "@/components/ui/Button";
import { InterestChip } from "@/components/ui/Chip";
import { FilterChips } from "@/components/ui/FilterChips";
import { Side } from "@/components/ui/Grid";
import { StatusPill } from "@/components/ui/StatusPill";
import { VerifiedBadge } from "@/components/ui/VerifiedBadge";
import { connectionsSubline, myActivityRow } from "@/lib/profile";
import { cardDateTime } from "@/lib/time";
import { ageFrom } from "@/lib/validation";
import { loadMyProfile, type MyActivity, type ProfileTab } from "@/server/me";
import { loadInterests, photoUrl, requireOnboarded } from "@/server/profile";
import { EditProfileButton } from "./EditProfileButton";

const TABS: { key: ProfileTab; label: string }[] = [
  { key: "created", label: "Created" },
  { key: "joined", label: "Joined" },
  { key: "past", label: "Past" },
];

/** S21 My profile. */
export default function ProfilePage({ searchParams }: PageProps<"/profile">) {
  return (
    <>
      <MobileHeader title="Profile" />
      <PageContainer>
        <Suspense fallback={<ProfileSkeleton />}>
          <Profile searchParams={searchParams} />
        </Suspense>
      </PageContainer>
    </>
  );
}

function Eyebrow({ id, children }: { id: string; children: string }) {
  return (
    <h2 id={id} className="text-[13px] font-bold tracking-[0.08em] text-slate uppercase">
      {children}
    </h2>
  );
}

async function Profile({ searchParams }: Pick<PageProps<"/profile">, "searchParams">) {
  const { tab: rawTab } = await searchParams;
  const tab: ProfileTab = TABS.some((t) => t.key === rawTab) ? (rawTab as ProfileTab) : "created";
  const { supabase, profile } = await requireOnboarded();
  const catalogue = await loadInterests(supabase);
  const me = await loadMyProfile(supabase, catalogue);
  const name = profile.firstName ?? "";
  const age = profile.showAge && profile.birthDate ? ageFrom(profile.birthDate) : null;
  const photo = photoUrl(profile.photoPath);
  const interests = catalogue.filter((i) => profile.interestIds.includes(i.id));
  const shown = me.activities.filter((a) => a.tab === tab);
  const extra = me.connectionsCount - me.connectionsPreview.length;

  const card = (
    <section aria-label="Your profile" className="overflow-hidden rounded-card border border-border bg-white">
      <div className={`relative h-[240px] ${photo ? "bg-sand" : tintFor(profile.id)}`}>
        {photo ? (
          <Image src={photo} alt={`Photo of ${name}`} fill unoptimized priority sizes="(min-width: 1024px) 260px, 100vw" className="object-cover" />
        ) : (
          <span role="img" aria-label={`Photo of ${name}`} className="flex h-full items-center justify-center font-display text-[80px] font-extrabold">
            {initials(name)}
          </span>
        )}
      </div>
      <div className="p-5">
        <div className="flex items-center gap-2">
          <h1 className="font-display text-[26px] leading-8 font-extrabold tracking-[-0.02em]">
            {age === null ? name : `${name}, ${age}`}
          </h1>
          <VerifiedBadge size={22} />
        </div>
        <p className="mt-1.5 flex items-center gap-2 text-[15px] text-slate">
          <MapPin size={18} strokeWidth={1.8} aria-hidden="true" />
          {[profile.areaName, profile.city].filter(Boolean).join(", ")}
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <EditProfileButton />
          <Link href="/settings" className={`${buttonClasses("secondary", "small")} gap-1.5! px-2! text-[14px]! whitespace-nowrap`}>
            <Settings size={16} strokeWidth={1.8} aria-hidden="true" className="shrink-0" />
            Settings
          </Link>
        </div>
      </div>
    </section>
  );

  return (
    <Side side={card}>
      <section aria-labelledby="about-heading">
        <Eyebrow id="about-heading">About</Eyebrow>
        <p className="mt-2 text-[16px] leading-6 text-charcoal">{profile.bio || "No bio yet."}</p>
      </section>

      <section aria-labelledby="interests-heading" className="mt-7">
        <div className="flex items-baseline justify-between gap-4">
          <Eyebrow id="interests-heading">Interests</Eyebrow>
          <Link
            href="/edit/interests"
            aria-label="Edit interests"
            className="rounded-input text-[15px] font-semibold text-blue-700 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-blue-600"
          >
            Edit
          </Link>
        </div>
        <ul className="mt-3 flex flex-wrap gap-2.5" aria-label="Your interests">
          {interests.map((i) => (
            <li key={i.id}>
              <InterestChip name={i.name} />
            </li>
          ))}
        </ul>
      </section>

      <ul aria-label="Stats" className="mt-7 grid gap-3.5 md:grid-cols-3 md:gap-[18px]">
        {[
          [me.connectionsCount, "Connections"],
          [me.createdCount, "Activities created"],
          [me.joinedCount, "Activities joined"],
        ].map(([n, label]) => (
          <li key={label} className="rounded-card border border-border bg-white px-5 py-4">
            <p className="font-display text-[28px] leading-9 font-extrabold">{n}</p>
            <p className="text-[15px] text-slate">{label}</p>
          </li>
        ))}
      </ul>

      <Link
        href="/profile/connections"
        className="mt-4 flex items-center gap-4 rounded-card border border-border bg-white px-5 py-4 hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
      >
        {me.connectionsPreview.length > 0 && (
          <span className="flex shrink-0 items-center">
            <AvatarStack people={me.connectionsPreview.map((p) => ({ id: p.id, name: p.firstName, photoUrl: p.photoUrl }))} />
            {extra > 0 && (
              <span className="-ml-2 inline-flex size-9 items-center justify-center rounded-full bg-sage text-[12px] font-bold text-sage-text ring-2 ring-white">
                +{extra}
              </span>
            )}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block font-display text-[17px] leading-6 font-bold">My connections</span>
          <span className="block text-[15px] text-slate">{connectionsSubline(me.pendingCount, me.connectionsCount)}</span>
        </span>
        <ChevronRight size={20} strokeWidth={1.8} aria-hidden="true" className="shrink-0 text-slate" />
      </Link>

      <section aria-labelledby="activities-heading" className="mt-9">
        <h2 id="activities-heading" className="font-display text-[22px] leading-7 font-bold">
          My activities
        </h2>
        <FilterChips
          label="My activities"
          className="mt-3.5"
          items={TABS.map((t) => ({
            key: t.key,
            label: `${t.label} · ${me.activities.filter((a) => a.tab === t.key).length}`,
            href: t.key === "created" ? "/profile" : `/profile?tab=${t.key}`,
            active: t.key === tab,
          }))}
        />
        {shown.length ? (
          <ul aria-label={TABS.find((t) => t.key === tab)!.label} className="mt-4 grid gap-3.5 md:grid-cols-2 md:gap-[18px]">
            {shown.map((a) => (
              <li key={a.id}>
                <ActivityRow a={a} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 rounded-card border border-border bg-white px-5 py-6 text-[15px] leading-[22px] text-slate">
            {tab === "created" ? (
              <>
                Nothing hosted yet.{" "}
                <Link href="/activities/new" className="font-semibold text-blue-700 underline underline-offset-4">
                  Create an activity
                </Link>
              </>
            ) : tab === "joined" ? (
              "You haven't joined anything coming up."
            ) : (
              "Finished and cancelled activities show up here."
            )}
          </p>
        )}
      </section>
    </Side>
  );
}

function ActivityRow({ a }: { a: MyActivity }) {
  const row = myActivityRow(a);
  return (
    <Link
      href={row.href}
      data-testid="my-activity"
      className="flex h-full overflow-hidden rounded-card border border-border bg-white transition hover:-translate-y-0.5 hover:shadow-card-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
    >
      <ActivityCover slug={a.interest.slug} interestName={a.interest.name} className="w-[112px] shrink-0" sizes="112px" chips={<></>} />
      <span className="flex min-w-0 flex-1 flex-col gap-1 p-4">
        <span className="truncate font-display text-[17px] leading-6 font-bold">{a.title}</span>
        <span className="text-[14px] text-slate">{cardDateTime(new Date(a.startsAt))}</span>
        <span className="mt-auto flex items-center justify-between gap-2 pt-1">
          <span className="min-w-0 truncate text-[14px] text-slate">{row.who}</span>
          <StatusPill variant={row.pill.variant}>{row.pill.label}</StatusPill>
        </span>
      </span>
    </Link>
  );
}

function ProfileSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-7 lg:grid lg:grid-cols-[260px_1fr] lg:gap-10">
      <div className="h-[420px] animate-pulse rounded-card bg-hover" />
      <div className="flex flex-col gap-4">
        <div className="h-24 animate-pulse rounded-card bg-hover" />
        <div className="h-[104px] animate-pulse rounded-card bg-hover" />
        <div className="h-[200px] animate-pulse rounded-card bg-hover" />
      </div>
    </div>
  );
}
