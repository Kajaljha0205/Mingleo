"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition, type PointerEvent } from "react";
import { Info, RotateCcw, UserPlus, Users, X } from "lucide-react";
import { DiscoverCard } from "@/components/cards/DiscoverCard";
import { Button, buttonClasses } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { joinNames } from "@/lib/format";
import type { Candidate } from "@/server/discover";
import { connect, skip, startOver } from "../people/actions";

const SWIPE_THRESHOLD = 110;

export function DiscoverDeck({ candidates }: { candidates: Candidate[] }) {
  const router = useRouter();
  const toast = useToast();
  // The server list is the source of truth (it changes after a request on S09, a new radius, …);
  // locally we only hide people acted on here until the server catches up.
  const [handled, setHandled] = useState<ReadonlySet<string>>(new Set());
  const queue = candidates.filter((c) => !handled.has(c.id));
  const [dx, setDx] = useState(0);
  const [restarting, startRestart] = useTransition();
  const drag = useRef<{ x: number; dx: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);

  const current = queue[0];
  const next = queue[1];

  function advance(action: "connect" | "skip") {
    const person = current;
    if (!person) return;
    setHandled((h) => new Set(h).add(person.id));
    setDx(0);
    void (async () => {
      const result = action === "connect" ? await connect(person.id) : await skip(person.id);
      if (result.error) {
        setHandled((h) => {
          const copy = new Set(h);
          copy.delete(person.id);
          return copy;
        });
        toast.show(result.error, "error");
      } else if (action === "connect") {
        toast.show(`Request sent to ${person.firstName}. It shows as Pending until they accept.`);
      }
    })();
  }

  function onPointerDown(e: PointerEvent) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    suppressClick.current = false;
    drag.current = { x: e.clientX, dx: 0, moved: false };
  }
  function onPointerMove(e: PointerEvent) {
    if (!drag.current) return;
    const delta = e.clientX - drag.current.x;
    if (Math.abs(delta) > 6) {
      if (!drag.current.moved) (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      drag.current.moved = true;
    }
    if (drag.current.moved) {
      drag.current.dx = delta;
      setDx(delta);
    }
  }
  function onPointerUp() {
    if (!drag.current) return;
    const { moved, dx: distance } = drag.current;
    drag.current = null;
    // A drag ends with a click on the photo link; don't let it navigate.
    suppressClick.current = moved;
    if (distance > SWIPE_THRESHOLD) advance("connect");
    else if (distance < -SWIPE_THRESHOLD) advance("skip");
    else setDx(0);
  }

  if (!current) {
    return (
      <div className="mx-auto mt-6 max-w-[560px]">
        <EmptyState
          icon={<Users size={28} strokeWidth={1.8} aria-hidden="true" />}
          title="You’re all caught up"
          help="New people show up as they join. Skipped profiles can come back in a later round."
          action={
            <Button
              variant="secondary"
              disabled={restarting}
              leadingIcon={<RotateCcw size={18} strokeWidth={1.8} aria-hidden="true" />}
              onClick={() =>
                startRestart(async () => {
                  const result = await startOver();
                  if (result.error) toast.show(result.error, "error");
                  else router.refresh();
                })
              }
            >
              Start over
            </Button>
          }
        />
      </div>
    );
  }

  const href = `/people/${current.id}?from=discover`;
  const swipeHint = dx > 40 ? "Connect" : dx < -40 ? "Skip" : null;
  const reduceMotion = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const transform = dx ? `translateX(${dx}px)${reduceMotion ? "" : ` rotate(${dx / 24}deg)`}` : undefined;

  return (
    <div className="mt-6 grid items-start gap-[22px] md:grid-cols-2 lg:grid-cols-[1.3fr_1fr]">
      <section aria-label="People to discover" className="mx-auto w-full max-w-[480px]">
        <div className="relative pt-5">
          {next && (
            <div
              aria-hidden="true"
              data-testid="peek-card"
              className="absolute inset-x-6 top-0 bottom-6 rounded-media border border-border bg-hover"
            />
          )}
          <div
            // New element per person so the next card appears in place instead of sliding back.
            key={current.id}
            data-testid="swipe-surface"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={() => {
              drag.current = null;
              setDx(0);
            }}
            onClickCapture={(e) => {
              if (suppressClick.current) {
                suppressClick.current = false;
                e.preventDefault();
                e.stopPropagation();
              }
            }}
            style={{ transform }}
            className={`relative touch-pan-y select-none ${dx ? "" : "transition-transform duration-200 motion-reduce:transition-none"}`}
          >
            <DiscoverCard person={current} href={href} priority />
            {swipeHint && (
              <span
                aria-hidden="true"
                className={`absolute top-6 right-6 rounded-full px-3 py-1.5 text-[14px] font-bold ${
                  swipeHint === "Connect" ? "bg-blue-600 text-white" : "bg-white text-charcoal"
                }`}
              >
                {swipeHint}
              </span>
            )}
          </div>
        </div>

        <div className="mt-5 flex justify-center gap-14">
          <DeckAction label="Skip" onClick={() => advance("skip")} variant="skip">
            <X size={28} strokeWidth={1.8} aria-hidden="true" />
          </DeckAction>
          <DeckAction label="Connect" onClick={() => advance("connect")} variant="connect">
            <UserPlus size={28} strokeWidth={1.8} aria-hidden="true" />
          </DeckAction>
        </div>
      </section>

      <div className="flex flex-col gap-[22px] lg:sticky lg:top-[108px]">
        <AboutPanel person={current} href={href} />
        <p className="flex gap-3 rounded-card bg-sand px-5 py-4 text-[15px] leading-[22px] text-charcoal">
          <Info size={20} strokeWidth={1.8} aria-hidden="true" className="mt-px shrink-0" />
          Swipe or use the buttons. On a keyboard, Tab to Skip or Connect and press Enter.
        </p>
      </div>
    </div>
  );
}

function DeckAction({
  label,
  onClick,
  variant,
  children,
}: {
  label: string;
  onClick: () => void;
  variant: "skip" | "connect";
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col items-center gap-2 rounded-card focus-visible:outline-none"
    >
      <span
        className={`inline-flex size-16 items-center justify-center rounded-full transition-colors group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-blue-600 ${
          variant === "connect"
            ? "bg-blue-600 text-white shadow-card-hover group-hover:bg-blue-700"
            : "border border-border-input bg-white text-charcoal group-hover:bg-hover"
        }`}
      >
        {children}
      </span>
      <span className={`text-[14px] ${variant === "connect" ? "font-bold text-blue-700" : "font-medium text-slate"}`}>
        {label}
      </span>
    </button>
  );
}

function AboutPanel({ person, href }: { person: Candidate; href: string }) {
  return (
    <section
      aria-labelledby="about-heading"
      className="rounded-card border border-border bg-white p-6"
    >
      <h2 id="about-heading" className="text-[12px] font-bold tracking-[0.08em] text-slate uppercase">
        About {person.firstName}
      </h2>
      {person.bio && <p className="mt-2 hidden text-[16px] leading-[25px] md:block">{person.bio}</p>}

      {person.recentActivities.length > 0 && (
        <>
          <h3 className="mt-5 text-[12px] font-bold tracking-[0.08em] text-slate uppercase">Recent activities</h3>
          <ul className="mt-2 divide-y divide-border">
            {person.recentActivities.map((a) => (
              <li key={a.id} className="py-3">
                <p className="text-[15px] font-bold">{a.title}</p>
                <p className="text-[14px] text-slate">
                  {a.role} · {a.people} people · {a.when}
                </p>
              </li>
            ))}
          </ul>
        </>
      )}

      {person.mutual.length > 0 && (
        <p className="mt-4 flex items-center gap-2.5 text-[15px] text-slate">
          <Users size={20} strokeWidth={1.8} aria-hidden="true" />
          You both know {joinNames(person.mutual.map((m) => m.firstName))}
        </p>
      )}

      <Link href={href} className={`${buttonClasses("secondary")} mt-5`}>
        View full profile
      </Link>
    </section>
  );
}
