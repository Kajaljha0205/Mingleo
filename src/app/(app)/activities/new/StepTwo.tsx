"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition, type ReactNode } from "react";
import { CalendarPlus, Globe, Lock, MapPin, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/FormField";
import { IconButton } from "@/components/ui/IconButton";
import { useToast } from "@/components/ui/Toast";
import {
  ADDRESS_MAX,
  dateChoices,
  EMPTY_DRAFT,
  LIMIT_MAX,
  LIMIT_MIN,
  validateDraft,
  validateStepOne,
  visibilityNote,
  type DraftErrors,
  type Visibility,
} from "@/lib/activity";
import { findArea, searchAreas } from "@/lib/locations/bengaluru";
import { clockTime, dateKey, dayChip, shortDate, zonedTime } from "@/lib/time";
import { createActivity } from "../actions";
import { ActivityPreview } from "./ActivityPreview";
import { CreateShell } from "./CreateShell";
import { useDraft } from "./draft";

type Props = {
  catalogue: { id: number; slug: string; name: string }[];
  host: { id: string; firstName: string; photoUrl: string | null };
};

/** S13 Create activity, step 2 of 2: where, when, who. */
export function StepTwo({ catalogue, host }: Props) {
  const router = useRouter();
  const toast = useToast();
  const { draft, update, clear } = useDraft();
  const d = draft ?? EMPTY_DRAFT;
  const [serverErrors, setServerErrors] = useState<DraftErrors>({});
  const [pending, startTransition] = useTransition();
  const published = useRef(false);
  const now = new Date();

  // Step 1 must be done first (e.g. a deep link or a cleared draft).
  const stepOneMissing = draft !== null && Object.keys(validateStepOne(draft)).length > 0;
  useEffect(() => {
    if (stepOneMissing && !published.current) router.replace("/activities/new");
  }, [stepOneMissing, router]);

  const errors = { ...validateDraft(d, now), ...serverErrors };
  const ready = draft !== null && Object.keys(validateDraft(d, now)).length === 0;
  const interest = catalogue.find((i) => i.id === d.interestId) ?? null;
  const area = d.areaSlug ? findArea(d.areaSlug) : undefined;
  const when = d.date && d.start ? `${shortDate(zonedTime(d.date, d.start))} · ${clockTime(zonedTime(d.date, d.start))}` : null;
  const chips = dateChoices(now);
  const today = dateKey(now);

  function change(patch: Parameters<typeof update>[0]) {
    setServerErrors({});
    update(patch);
  }

  function publish() {
    if (!draft) return;
    startTransition(async () => {
      const result = await createActivity(draft);
      if (result.errors) return setServerErrors(result.errors);
      if (result.error || !result.id) return toast.show(result.error ?? "Couldn't publish. Please try again.", "error");
      published.current = true;
      clear();
      toast.show("Published. People can now find it and ask to join.");
      router.push(`/activities/${result.id}/manage`);
    });
  }

  return (
    <CreateShell
      back={{ href: "/activities/new", label: "Back to step 1" }}
      step="Step 2 of 2"
      title="Where, when and who"
      form={
        <div className="flex flex-col gap-6">
          <AreaPicker
            areaName={area?.name ?? null}
            onPick={(slug) => change({ areaSlug: slug })}
            error={draft && serverErrors.where}
          />
          <TextField
            id="activity-address"
            label="Venue or exact address (optional)"
            placeholder="e.g. Court 3, 27th Main"
            value={d.address}
            maxLength={ADDRESS_MAX}
            onChange={(e) => change({ address: e.target.value })}
            error={errors.address}
          />
          <p className="-mt-4 text-[13px] text-slate">Only you and people you accept will see this.</p>

          <fieldset>
            <legend className="text-[13px] font-bold">When</legend>
            <div className="mt-2.5 grid grid-cols-4 gap-2 md:gap-3">
              {chips.map((key) => {
                const c = dayChip(key);
                const selected = d.date === key;
                return (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={selected}
                    aria-label={shortDate(zonedTime(key, "12:00"))}
                    onClick={() => change({ date: key })}
                    className={`flex min-h-[68px] flex-col items-center justify-center rounded-input border text-[14px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
                      selected ? "border-blue-600 border-2 bg-light-blue text-blue-700" : "border-border-input bg-white hover:bg-hover"
                    }`}
                  >
                    {c.weekday}
                    <span className="font-display text-[22px] leading-7 font-extrabold">{c.day}</span>
                  </button>
                );
              })}
            </div>
            <label
              className={`mt-3 flex min-h-[54px] items-center gap-3 rounded-input border bg-white px-4 text-[15px] focus-within:outline-2 focus-within:outline-blue-600 ${
                d.date && !chips.includes(d.date) ? "border-2 border-blue-600" : "border-border-input"
              }`}
            >
              <CalendarPlus size={20} strokeWidth={1.8} aria-hidden="true" className="shrink-0 text-blue-600" />
              <span className="font-semibold">Later date</span>
              <input
                type="date"
                min={today}
                value={d.date && !chips.includes(d.date) ? d.date : ""}
                onChange={(e) => e.target.value && change({ date: e.target.value })}
                className="ml-auto min-w-0 bg-transparent text-right text-[16px] focus:outline-none"
                aria-label="Pick a later date"
              />
            </label>
            {d.date && errors.date && <p className="mt-2 text-[13px] font-semibold text-danger">{errors.date}</p>}
            <div className="mt-3 grid grid-cols-2 gap-3">
              <TextField
                id="activity-start"
                label="Starts"
                type="time"
                required
                value={d.start}
                onChange={(e) => change({ start: e.target.value })}
                error={d.start ? errors.start : undefined}
              />
              <TextField
                id="activity-end"
                label="Ends (optional)"
                type="time"
                value={d.end}
                onChange={(e) => change({ end: e.target.value })}
                error={d.end ? errors.end : undefined}
              />
            </div>
          </fieldset>

          <div className="flex items-center gap-4 rounded-card border border-border bg-white p-4">
            <div className="min-w-0 flex-1">
              <p id="people-label" className="text-[16px] font-bold">
                People, including you
              </p>
              <p className="text-[14px] text-slate">Join requests stop when it&apos;s full</p>
            </div>
            <IconButton
              label="Fewer people"
              bordered
              disabled={d.limit <= LIMIT_MIN}
              onClick={() => change({ limit: Math.max(LIMIT_MIN, d.limit - 1) })}
              className="disabled:opacity-40"
            >
              <Minus size={20} strokeWidth={1.8} aria-hidden="true" />
            </IconButton>
            <output aria-labelledby="people-label" aria-live="polite" className="w-7 text-center font-display text-[22px] font-extrabold">
              {d.limit}
            </output>
            <IconButton
              label="More people"
              disabled={d.limit >= LIMIT_MAX}
              onClick={() => change({ limit: Math.min(LIMIT_MAX, d.limit + 1) })}
              className="bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40"
            >
              <Plus size={20} strokeWidth={1.8} aria-hidden="true" />
            </IconButton>
          </div>

          <fieldset>
            <legend className="text-[13px] font-bold">Who can find and join</legend>
            <div className="mt-2.5 flex flex-col gap-3">
              <VisibilityOption
                value="connections"
                current={d.visibility}
                onChange={(v) => change({ visibility: v })}
                icon={<Lock size={22} strokeWidth={1.8} aria-hidden="true" />}
                title="Connections only"
                help="Only people you're connected with"
              />
              <VisibilityOption
                value="connections_and_nearby"
                current={d.visibility}
                onChange={(v) => change({ visibility: v })}
                icon={<Globe size={22} strokeWidth={1.8} aria-hidden="true" />}
                title="Connections + people nearby"
                help="Nearby people with matching interests can request. You approve each one."
              />
            </div>
          </fieldset>
        </div>
      }
      preview={
        <>
          <ActivityPreview
            interest={interest}
            title={d.title}
            host={host}
            when={when}
            where={area?.name ?? null}
            limit={d.limit}
          />
          <p className="mt-3 text-[15px] leading-[22px] text-slate" data-testid="visibility-note">
            {visibilityNote(d.visibility, interest?.name ?? null)}
          </p>
        </>
      }
      actions={
        <>
          <Button variant="secondary" onClick={() => router.push("/activities/new")}>
            Back
          </Button>
          <Button disabled={!ready || pending} onClick={publish}>
            {pending ? "Publishing…" : "Publish activity"}
          </Button>
        </>
      }
    />
  );
}

function AreaPicker({ areaName, onPick, error }: { areaName: string | null; onPick: (slug: string) => void; error?: string | false | null }) {
  const [query, setQuery] = useState<string | null>(null);
  const listId = useId();
  const results = query === null ? [] : searchAreas(query);
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="activity-where" className="text-[13px] font-bold">
        Where
      </label>
      <div className="relative">
        <MapPin size={20} strokeWidth={1.8} aria-hidden="true" className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-blue-600" />
        <input
          id="activity-where"
          role="combobox"
          aria-expanded={results.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
          placeholder="Search an area"
          value={query ?? areaName ?? ""}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setQuery((q) => q ?? "")}
          onBlur={() => setTimeout(() => setQuery(null), 150)}
          className={`h-[54px] w-full rounded-input border bg-white pr-4 pl-12 text-[16px] font-medium focus:border-blue-600 focus:outline-[1.5px] focus:-outline-offset-1 focus:outline-blue-600 ${
            error ? "border-danger" : "border-border-input"
          }`}
        />
      </div>
      {results.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Areas"
          onMouseDown={(e) => e.preventDefault()}
          className="max-h-64 overflow-y-auto rounded-input border border-border bg-white"
        >
          {results.map((a) => (
            <li key={a.slug} role="option" aria-selected={a.name === areaName}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onPick(a.slug);
                  setQuery(null);
                }}
                className="flex min-h-11 w-full items-center gap-3 px-4 text-left text-[15px] hover:bg-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-600"
              >
                <MapPin size={16} strokeWidth={1.8} aria-hidden="true" className="text-slate" />
                {a.name}
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="text-[13px] font-semibold text-danger">{error}</p>}
    </div>
  );
}

function VisibilityOption({
  value,
  current,
  onChange,
  icon,
  title,
  help,
}: {
  value: Visibility;
  current: Visibility;
  onChange: (v: Visibility) => void;
  icon: ReactNode;
  title: string;
  help: string;
}) {
  const selected = value === current;
  return (
    <label
      className={`flex cursor-pointer gap-3.5 rounded-card border p-4 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-blue-600 ${
        selected ? "border-2 border-blue-600 bg-light-blue" : "border-border bg-white hover:bg-hover"
      }`}
    >
      <input type="radio" name="visibility" value={value} checked={selected} onChange={() => onChange(value)} className="sr-only" />
      <span className={`mt-0.5 shrink-0 ${selected ? "text-blue-700" : "text-slate"}`}>{icon}</span>
      <span className="min-w-0">
        <span className="block text-[16px] font-bold">{title}</span>
        <span className="block text-[15px] text-slate">{help}</span>
      </span>
    </label>
  );
}
