"use client";

import { useState, useTransition } from "react";
import { MapPin, Search } from "lucide-react";
import { OnboardingActions } from "@/components/onboarding/OnboardingShell";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { SearchInput } from "@/components/ui/SearchInput";
import {
  CITY,
  findArea,
  nearestArea,
  RADIUS_OPTIONS,
  searchAreas,
  type Area,
  type RadiusKm,
} from "@/lib/locations/bengaluru";
import { saveLocation } from "../actions";

type Mode = "idle" | "explain" | "locating" | "choose";

type Props = { initialAreaSlug: string | null; initialRadius: RadiusKm; from?: string; back?: string; saveLabel?: string };

export function LocationStep({ initialAreaSlug, initialRadius, from, back, saveLabel = "Continue" }: Props) {
  const [area, setArea] = useState<Area | null>(
    initialAreaSlug ? (findArea(initialAreaSlug) ?? null) : null,
  );
  const [radius, setRadius] = useState<RadiusKm>(initialRadius);
  const [mode, setMode] = useState<Mode>("idle");
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function chooseInstead(message: string) {
    setNotice(message);
    setMode("choose");
  }

  function locate() {
    if (!("geolocation" in navigator)) {
      return chooseInstead("Your browser can't share location. Choose an area instead.");
    }
    setMode("locating");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const found = nearestArea(coords.latitude, coords.longitude);
        if (!found) {
          return chooseInstead(`You seem to be outside ${CITY}. Choose an area instead.`);
        }
        setArea(found);
        setNotice(null);
        setMode("idle");
      },
      () => chooseInstead("Location is off. Choose an area instead."),
      { maximumAge: 600_000, timeout: 15_000 },
    );
  }

  function pick(a: Area) {
    setArea(a);
    setQuery("");
    setNotice(null);
    setMode("idle");
  }

  function save() {
    if (!area) return;
    startTransition(async () => {
      const result = back
        ? await saveLocation(area.slug, radius, from, back)
        : await saveLocation(area.slug, radius, from);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="flex flex-1 flex-col">
      <MapPreview area={area} radius={radius} />

      {mode === "explain" || mode === "locating" ? (
        <div className="mt-5 rounded-card border border-border bg-white p-5" role="region" aria-label="Use current location">
          <p className="text-[15px] leading-[22px] text-charcoal">
            We&apos;ll ask your browser for your location once, to find your neighbourhood. Only
            the neighbourhood is saved — never your exact location.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <Button size="small" variant="secondary" onClick={() => setMode("idle")}>
              Not now
            </Button>
            <Button size="small" onClick={locate} disabled={mode === "locating"}>
              {mode === "locating" ? "Finding you…" : "Allow location"}
            </Button>
          </div>
        </div>
      ) : mode === "choose" ? (
        <div className="mt-5 flex flex-col gap-3">
          {notice && (
            <p role="status" className="rounded-input bg-sunshine px-4 py-3 text-[14px] font-semibold text-sunshine-text">
              {notice}
            </p>
          )}
          <label htmlFor="area-search" className="text-[13px] font-bold">
            Choose an area
          </label>
          <SearchInput
            id="area-search"
            autoFocus
            placeholder={`Search neighbourhoods in ${CITY}`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <ul className="max-h-64 overflow-y-auto rounded-input border border-border bg-white" aria-label="Areas">
            {searchAreas(query).map((a) => (
              <li key={a.slug} className="border-b border-border last:border-0">
                <button
                  type="button"
                  onClick={() => pick(a)}
                  className="flex min-h-11 w-full items-center gap-3 px-4 text-left text-[15px] hover:bg-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-600"
                >
                  <MapPin size={16} strokeWidth={1.8} aria-hidden="true" className="text-slate" />
                  {a.name}
                </button>
              </li>
            ))}
            {searchAreas(query).length === 0 && (
              <li className="px-4 py-3 text-[14px] text-slate">No areas match “{query}”.</li>
            )}
          </ul>
        </div>
      ) : (
        <div className="mt-5 flex flex-col gap-2.5">
          <Button leadingIcon={<MapPin size={18} strokeWidth={1.8} aria-hidden="true" />} onClick={() => setMode("explain")}>
            Use current location
          </Button>
          <Button
            variant="secondary"
            leadingIcon={<Search size={18} strokeWidth={1.8} aria-hidden="true" />}
            onClick={() => setMode("choose")}
          >
            Choose an area
          </Button>
        </div>
      )}

      <fieldset className="mt-6">
        <legend className="text-[13px] font-bold">Discovery radius</legend>
        <div className="mt-2.5 flex flex-wrap gap-2.5">
          {RADIUS_OPTIONS.map((r) => (
            <Chip key={r} selected={radius === r} onClick={() => setRadius(r)}>
              {r} km
            </Chip>
          ))}
        </div>
      </fieldset>

      {error && (
        <p role="alert" className="mt-4 text-[14px] font-semibold text-danger">
          {error}
        </p>
      )}
      <OnboardingActions>
        <Button disabled={!area || pending} onClick={save}>
          {pending ? "Saving…" : saveLabel}
        </Button>
      </OnboardingActions>
    </div>
  );
}

const CIRCLE_PX: Record<RadiusKm, number> = { 2: 96, 5: 170, 10: 230, 25: 300 };

/** Illustrative map (no tiles in V1): area label + radius circle. */
function MapPreview({ area, radius }: { area: Area | null; radius: RadiusKm }) {
  return (
    <div
      data-testid="map-preview"
      className="relative mt-6 h-[200px] overflow-hidden rounded-media bg-hover"
      role="img"
      aria-label={area ? `${area.name}, ${CITY}, within ${radius} km` : "No area chosen yet"}
    >
      <span className="absolute inset-y-0 left-[30%] w-2.5 bg-white" />
      <span className="absolute inset-y-0 left-[72%] w-2.5 bg-white" />
      <span className="absolute inset-x-0 top-[36%] h-2.5 bg-white" />
      <span className="absolute inset-x-0 top-[74%] h-2 bg-white" />
      <span className="absolute top-[48%] left-[6%] h-9 w-[18%] rounded-input bg-sage" />
      {area && (
        <>
          <span
            data-testid="radius-circle"
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-blue-600 bg-light-blue/70 transition-all"
            style={{ width: CIRCLE_PX[radius], height: CIRCLE_PX[radius] }}
          />
          <MapPin
            size={30}
            strokeWidth={1.8}
            aria-hidden="true"
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-full text-blue-700"
          />
        </>
      )}
      <span className="absolute bottom-3 left-3 rounded-full bg-white px-3 py-1.5 text-[14px] font-bold">
        {area ? `${area.name}, ${CITY}` : "No area chosen yet"}
      </span>
    </div>
  );
}
