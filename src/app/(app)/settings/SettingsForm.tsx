"use client";

import Link from "next/link";
import { useState, useTransition, type ReactNode } from "react";
import { BadgeCheck, ChevronDown, ChevronRight, LogOut, MapPin } from "lucide-react";
import { signOut } from "@/app/auth/actions";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Sheet } from "@/components/ui/Sheet";
import { Switch } from "@/components/ui/Switch";
import { useToast } from "@/components/ui/Toast";
import { VERIFIED_LABEL } from "@/components/ui/VerifiedBadge";
import { plural } from "@/lib/format";
import { RADIUS_OPTIONS } from "@/lib/locations/bengaluru";
import { discoverableHelp, HISTORY_OPTIONS, NOTIFY_TOGGLES, type Settings } from "@/lib/settings";
import type { MiniPerson } from "@/server/discover";
import { unblockPerson, updateSetting } from "./actions";

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="mt-7 first:mt-6">
      <h2 id={id} className="mb-3 text-[13px] font-bold tracking-[0.08em] text-slate uppercase">
        {title}
      </h2>
      <div className="divide-y divide-border overflow-hidden rounded-card border border-border bg-white">{children}</div>
    </section>
  );
}

const rowLink =
  "flex min-h-[60px] items-center gap-3 px-4 py-3.5 text-[16px] hover:bg-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-600 md:px-5";

export function SettingsForm({ initial, place, blocked }: { initial: Settings; place: string; blocked: MiniPerson[] }) {
  const toast = useToast();
  const [s, setS] = useState(initial);
  const [, startTransition] = useTransition();
  const [blockedOpen, setBlockedOpen] = useState(false);
  const [blockedList, setBlockedList] = useState(blocked);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  /** ST-180.2: optimistic, rolled back with an error toast. */
  function save<K extends keyof Settings>(key: K, value: Settings[K]) {
    const previous = s[key];
    setS((cur) => ({ ...cur, [key]: value }));
    startTransition(async () => {
      const r = await updateSetting(key, value);
      if (r.error) {
        setS((cur) => ({ ...cur, [key]: previous }));
        toast.show(r.error, "error");
      }
    });
  }

  function unblock(p: MiniPerson) {
    setConfirmId(null);
    setBlockedList((l) => l.filter((x) => x.id !== p.id));
    startTransition(async () => {
      const r = await unblockPerson(p.id);
      if (r.error) {
        setBlockedList((l) => [p, ...l]);
        return toast.show(r.error, "error");
      }
      toast.show(`${p.firstName} is unblocked.`);
    });
  }

  return (
    <>
      <Section id="discovery-heading" title="Discovery">
        <Link href="/location?from=settings" className={rowLink}>
          <MapPin size={20} strokeWidth={1.8} aria-hidden="true" className="shrink-0 text-blue-700" />
          <span className="flex-1 font-semibold">Location</span>
          <span className="truncate text-slate">{place}</span>
          <ChevronRight size={20} strokeWidth={1.8} aria-hidden="true" className="shrink-0 text-slate" />
        </Link>
        <div className="px-4 py-3.5 md:px-5" role="group" aria-labelledby="radius-label">
          <div className="flex items-baseline justify-between gap-3">
            <p id="radius-label" className="text-[16px] font-semibold">
              Discovery radius
            </p>
            <p className="text-[16px] font-bold text-blue-700" aria-hidden="true">
              {s.radiusKm} km
            </p>
          </div>
          <div className="mt-3 flex flex-wrap gap-2.5">
            {RADIUS_OPTIONS.map((r) => (
              <Chip key={r} selected={s.radiusKm === r} onClick={() => save("radiusKm", r)}>
                {r} km
              </Chip>
            ))}
          </div>
        </div>
        <Switch
          id="discoverable"
          bordered={false}
          label="Show me in Discover"
          description={discoverableHelp(s.discoverable)}
          checked={s.discoverable}
          onChange={(v) => save("discoverable", v)}
        />
      </Section>

      <Section id="privacy-heading" title="Privacy">
        <Switch
          id="showAge"
          bordered={false}
          label="Show my age on profile"
          description="You can change this any time"
          checked={s.showAge}
          onChange={(v) => save("showAge", v)}
        />
        <div className="flex flex-wrap items-center gap-3 px-4 py-3.5 md:px-5">
          <label htmlFor="history" className="min-w-0 flex-1 text-[15px] font-bold">
            Who sees my activity history
          </label>
          <span className="relative w-full sm:w-auto">
            <select
              id="history"
              value={s.historyVisibility}
              onChange={(e) => save("historyVisibility", e.target.value as Settings["historyVisibility"])}
              className="h-12 w-full appearance-none rounded-input border border-border-input bg-white pr-10 pl-4 text-[16px] focus:border-blue-600 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 sm:w-[220px]"
            >
              {HISTORY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <ChevronDown size={18} strokeWidth={1.8} aria-hidden="true" className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2" />
          </span>
        </div>
        <button type="button" aria-haspopup="dialog" onClick={() => setBlockedOpen(true)} className={`${rowLink} w-full text-left`}>
          <span className="flex-1 font-semibold">Blocked people</span>
          <span className="text-slate">{blockedList.length ? plural(blockedList.length, "person", "people") : "None"}</span>
          <ChevronRight size={20} strokeWidth={1.8} aria-hidden="true" className="shrink-0 text-slate" />
        </button>
      </Section>

      <Section id="notify-heading" title="Notify me about">
        {NOTIFY_TOGGLES.map((t) => (
          <Switch
            key={t.key}
            id={t.key}
            bordered={false}
            label={t.label}
            checked={s[t.key] as boolean}
            onChange={(v) => save(t.key, v)}
          />
        ))}
      </Section>

      <Section id="account-heading" title="Account">
        <div className="flex min-h-[60px] items-center gap-3 px-4 py-3.5 md:px-5">
          <BadgeCheck size={20} strokeWidth={1.8} aria-hidden="true" className="shrink-0 text-mingle-blue" />
          <span className="flex-1 text-[16px] font-semibold">Verification</span>
          <span className="text-[16px] font-bold text-sage-text">{VERIFIED_LABEL}</span>
        </div>
        <form action={signOut}>
          <button type="submit" className={`${rowLink} w-full font-semibold text-danger`}>
            <LogOut size={20} strokeWidth={1.8} aria-hidden="true" className="shrink-0" />
            Log out
          </button>
        </form>
      </Section>

      <Sheet open={blockedOpen} onClose={() => setBlockedOpen(false)} title="Blocked people">
        {blockedList.length ? (
          <ul className="flex flex-col">
            {blockedList.map((p) =>
              confirmId === p.id ? (
                // Q-67: confirm first.
                <li key={p.id} className="border-b border-border py-3 last:border-0" role="group" aria-label={`Unblock ${p.firstName}?`}>
                  <p className="text-[16px] font-semibold">Unblock {p.firstName}?</p>
                  <p className="text-[14px] text-slate">You&apos;ll be able to find each other again. You won&apos;t be reconnected.</p>
                  <div className="mt-3 grid grid-cols-2 gap-2.5">
                    <Button variant="secondary" size="small" onClick={() => setConfirmId(null)}>
                      Cancel
                    </Button>
                    <Button size="small" onClick={() => unblock(p)}>
                      Unblock
                    </Button>
                  </div>
                </li>
              ) : (
                <li key={p.id} className="flex items-center gap-3 border-b border-border py-3 last:border-0">
                  <Avatar id={p.id} name={p.firstName} photoUrl={p.photoUrl} size={40} />
                  <span className="min-w-0 flex-1 truncate text-[16px] font-semibold">{p.firstName}</span>
                  <Button variant="secondary" size="small" className="w-auto!" onClick={() => setConfirmId(p.id)} aria-label={`Unblock ${p.firstName}`}>
                    Unblock
                  </Button>
                </li>
              ),
            )}
          </ul>
        ) : (
          <p className="text-[15px] leading-[22px] text-slate">You haven&apos;t blocked anyone.</p>
        )}
        <p className="mt-4 text-[14px] leading-5 text-slate">Unblocking doesn&apos;t restore a connection. They won&apos;t be told.</p>
      </Sheet>
    </>
  );
}
