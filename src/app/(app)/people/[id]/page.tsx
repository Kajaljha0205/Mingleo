import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ChevronLeft, MapPin } from "lucide-react";
import { MobileHeader, PageContainer } from "@/components/app/AppShell";
import { AvatarStack, initials, tintFor } from "@/components/ui/Avatar";
import { InterestChip } from "@/components/ui/Chip";
import { VerifiedBadge } from "@/components/ui/VerifiedBadge";
import { distanceLabel, plural } from "@/lib/format";
import { originFrom } from "@/lib/origins";
import { loadPerson } from "@/server/discover";
import { loadInterests, requireOnboarded } from "@/server/profile";
import { PersonActions } from "./PersonActions";

export default function PersonPage({ params, searchParams }: PageProps<"/people/[id]">) {
  return (
    <Suspense fallback={<PersonSkeleton />}>
      <Person params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Person({ params, searchParams }: PageProps<"/people/[id]">) {
  const [{ id }, { from }] = await Promise.all([params, searchParams]);
  const origin = originFrom(from);
  const { supabase } = await requireOnboarded();
  const catalogue = await loadInterests(supabase);
  // Unknown, blocked (either way) or not-onboarded people all 404 so existence isn't leaked.
  const person = await loadPerson(supabase, id, catalogue);
  if (!person) notFound();

  const name = person.age === null ? person.firstName : `${person.firstName}, ${person.age}`;

  return (
    <>
      <MobileHeader title={person.firstName} back={{ href: origin.href, label: `Back to ${origin.label}` }} />
      <PageContainer>
        <Link
          href={origin.href}
          className="hidden items-center gap-2 rounded-input text-[16px] font-semibold text-slate hover:text-charcoal focus-visible:outline-2 focus-visible:outline-blue-600 md:inline-flex"
        >
          <ChevronLeft size={20} strokeWidth={1.8} aria-hidden="true" />
          Back to {origin.label}
        </Link>

        <div className="grid gap-6 md:mt-6 md:grid-cols-2 md:gap-7 lg:grid-cols-[1.3fr_1fr] lg:gap-10">
          <div
            data-testid="person-photo"
            className={`relative h-[380px] overflow-hidden rounded-media ${person.photoUrl ? "bg-sand" : tintFor(person.id)}`}
          >
            {person.photoUrl ? (
              <Image
                src={person.photoUrl}
                alt={`Photo of ${person.firstName}`}
                fill
                unoptimized
                priority
                sizes="(min-width: 1024px) 640px, (min-width: 768px) 50vw, 100vw"
                className="object-cover"
              />
            ) : (
              <span role="img" aria-label={`Photo of ${person.firstName}`} className="flex h-full items-center justify-center font-display text-[120px] font-extrabold">
                {initials(person.firstName)}
              </span>
            )}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <h1 className="font-display text-[30px] leading-9 font-extrabold tracking-[-0.02em] lg:text-[36px] lg:leading-[42px]">
                {name}
              </h1>
              <VerifiedBadge size={26} />
            </div>
            <p className="mt-1 flex items-center gap-2 text-[16px] text-slate">
              <MapPin size={18} strokeWidth={1.8} aria-hidden="true" />
              {person.areaName} · {distanceLabel(person.distanceKm)} away
            </p>

            <PersonActions
              // Remount if the server state changes (e.g. accepted elsewhere).
              key={person.relationship}
              personId={person.id}
              name={person.firstName}
              initial={person.relationship}
              backHref={origin.href}
            />

            {person.bio && <p className="mt-6 text-[16px] leading-[25px]">{person.bio}</p>}

            <h2 className="mt-6 text-[12px] font-bold tracking-[0.08em] text-slate uppercase">
              Interests · {person.sharedCount} shared
            </h2>
            <ul className="mt-3 flex flex-wrap gap-2" aria-label="Interests">
              {person.interests.map((i) => (
                <li key={i.name}>
                  <InterestChip name={i.name} shared={i.shared} />
                </li>
              ))}
            </ul>

            {person.historyVisible && person.recentActivities.length > 0 && (
              <>
                <h2 className="mt-6 text-[12px] font-bold tracking-[0.08em] text-slate uppercase">Recent activities</h2>
                <ul className="mt-3 flex flex-col gap-3">
                  {person.recentActivities.map((a) => (
                    <li key={a.id} className="rounded-card border border-border bg-white p-4">
                      <p className="text-[16px] font-bold">{a.title}</p>
                      <p className="text-[14px] text-slate">
                        {a.role} · {a.people} people · {a.when}
                      </p>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {person.mutual.length > 0 && (
              <div className="mt-6 flex items-center gap-3" data-testid="mutual">
                <AvatarStack
                  people={person.mutual.slice(0, 3).map((m) => ({ id: m.id, name: m.firstName, photoUrl: m.photoUrl }))}
                />
                <p className="text-[16px] text-slate">
                  {plural(person.mutual.length, "mutual connection", "mutual connections")}:{" "}
                  <span className="font-bold text-charcoal">{person.mutual.map((m) => m.firstName).join(", ")}</span>
                </p>
              </div>
            )}
          </div>
        </div>
      </PageContainer>
    </>
  );
}

function PersonSkeleton() {
  return (
    <PageContainer>
      <div aria-busy="true" className="grid gap-6 md:mt-12 md:grid-cols-2 lg:grid-cols-[1.3fr_1fr]">
        <div className="h-[380px] animate-pulse rounded-media bg-hover" />
        <div className="h-[240px] animate-pulse rounded-card bg-hover" />
      </div>
    </PageContainer>
  );
}
