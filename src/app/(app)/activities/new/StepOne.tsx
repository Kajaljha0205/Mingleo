"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { TextAreaField, TextField } from "@/components/ui/FormField";
import { InterestIcon } from "@/components/ui/InterestIcon";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { DETAILS_MAX, EMPTY_DRAFT, TITLE_MAX, validateStepOne, type Draft, type DraftErrors } from "@/lib/activity";
import { updateActivityDetails } from "../actions";
import { ActivityPreview } from "./ActivityPreview";
import { CreateShell } from "./CreateShell";
import { useDraft } from "./draft";

type Interest = { id: number; slug: string; name: string };
type Host = { id: string; firstName: string; photoUrl: string | null };

type Props = {
  catalogue: Interest[];
  mine: number[];
  host: Host;
  /** ST-114: edit a published activity — title and details only. */
  edit?: { id: string; interestId: number; title: string; details: string };
  /** ST-115: re-host — replaces the draft once, date and time left blank. */
  prefill?: Draft;
};

export function StepOne(props: Props) {
  return props.edit ? <EditDetails {...props} edit={props.edit} /> : <CreateStepOne {...props} />;
}

function CreateStepOne({ catalogue, mine, host, prefill }: Props) {
  const router = useRouter();
  const { draft, update, clear } = useDraft();
  const applied = useRef(false);
  useEffect(() => {
    if (!prefill || applied.current) return;
    applied.current = true;
    update(prefill);
    // Drop ?from= so a reload or Back doesn't overwrite later edits.
    router.replace("/activities/new");
  }, [prefill, update, router]);
  const d = draft ?? EMPTY_DRAFT;
  const valid = draft !== null && Object.keys(validateStepOne(d)).length === 0;
  return (
    <WhatForm
      catalogue={catalogue}
      mine={mine}
      host={host}
      values={d}
      onChange={update}
      back={{ href: "/activities", label: "Back to Activities" }}
      step="Step 1 of 2"
      title="What do you want to do?"
      actions={
        <>
          <Button
            variant="secondary"
            onClick={() => {
              clear();
              router.push("/activities");
            }}
          >
            Cancel
          </Button>
          <Button disabled={!valid} onClick={() => router.push("/activities/new/details")}>
            Next: where, when, who
          </Button>
        </>
      }
    />
  );
}

function EditDetails({ catalogue, mine, host, edit }: Props & { edit: NonNullable<Props["edit"]> }) {
  const router = useRouter();
  const toast = useToast();
  const [values, setValues] = useState({ interestId: edit.interestId, title: edit.title, details: edit.details });
  const [errors, setErrors] = useState<DraftErrors>({});
  const [pending, startTransition] = useTransition();
  const manage = `/activities/${edit.id}/manage`;
  const valid = Object.keys(validateStepOne(values)).length === 0;

  return (
    <WhatForm
      catalogue={catalogue}
      mine={mine}
      host={host}
      values={values}
      onChange={(p) => setValues((v) => ({ ...v, ...p, interestId: edit.interestId }))}
      errors={errors}
      locked
      back={{ href: manage, label: "Back to your activity" }}
      title="Edit details"
      actions={
        <>
          <Button variant="secondary" onClick={() => router.push(manage)}>
            Cancel
          </Button>
          <Button
            disabled={!valid || pending}
            onClick={() =>
              startTransition(async () => {
                const result = await updateActivityDetails(edit.id, values.title, values.details);
                if (result.errors) return setErrors(result.errors);
                if (result.error) return toast.show(result.error, "error");
                toast.show("Details saved.");
                router.push(manage);
              })
            }
          >
            {pending ? "Saving…" : "Save"}
          </Button>
        </>
      }
    />
  );
}

type Values = { interestId: number | null; title: string; details: string };

function WhatForm({
  catalogue,
  mine,
  host,
  values,
  onChange,
  errors = {},
  locked = false,
  back,
  step,
  title,
  actions,
}: {
  catalogue: Interest[];
  mine: number[];
  host: Host;
  values: Values;
  onChange: (patch: Partial<Values>) => void;
  errors?: DraftErrors;
  locked?: boolean;
  back: { href: string; label: string };
  step?: string;
  title: string;
  actions: ReactNode;
}) {
  const [allOpen, setAllOpen] = useState(false);
  const chosen = catalogue.find((i) => i.id === values.interestId) ?? null;
  // My interests, plus the chosen one if it came from "All interests".
  const options = locked
    ? catalogue.filter((i) => i.id === values.interestId)
    : catalogue.filter((i) => mine.includes(i.id) || i.id === values.interestId);
  const titleError = errors.title ?? (values.title.length > TITLE_MAX ? `Use ${TITLE_MAX} characters or fewer.` : undefined);

  return (
    <CreateShell
      back={back}
      step={step}
      title={title}
      form={
        <div className="flex flex-col gap-6">
          <fieldset>
            <legend className="text-[13px] font-bold">
              Interest · {locked ? "can't change after publishing" : "pick one"}
            </legend>
            <div className="mt-2.5 flex flex-wrap gap-2.5">
              {options.map((i) => (
                <Chip
                  key={i.id}
                  selected={values.interestId === i.id}
                  disabled={locked}
                  onClick={() => onChange({ interestId: i.id })}
                  className="disabled:cursor-not-allowed"
                >
                  {values.interestId !== i.id && <InterestIcon slug={i.slug} />}
                  {i.name}
                </Chip>
              ))}
              {!locked && (
                <button
                  type="button"
                  aria-haspopup="dialog"
                  onClick={() => setAllOpen(true)}
                  className="inline-flex min-h-11 items-center rounded-full border border-dashed border-border-input px-4 text-[15px] font-semibold text-blue-700 hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                >
                  All interests
                </button>
              )}
            </div>
            {errors.interest && <p className="mt-2 text-[13px] font-semibold text-danger">{errors.interest}</p>}
          </fieldset>

          <TextField
            id="activity-title"
            label="Title"
            value={values.title}
            maxLength={TITLE_MAX}
            required
            onChange={(e) => onChange({ title: e.target.value })}
            error={titleError}
            count={{ value: values.title.length, max: TITLE_MAX }}
          />
          <TextAreaField
            id="activity-details"
            label="Details (optional)"
            rows={4}
            value={values.details}
            maxLength={DETAILS_MAX}
            onChange={(e) => onChange({ details: e.target.value })}
            error={errors.details}
            count={{ value: values.details.length, max: DETAILS_MAX }}
          />

          <Sheet open={allOpen} onClose={() => setAllOpen(false)} title="All interests">
            <div className="flex flex-wrap gap-2.5">
              {catalogue.map((i) => (
                <Chip
                  key={i.id}
                  selected={values.interestId === i.id}
                  onClick={() => {
                    onChange({ interestId: i.id });
                    setAllOpen(false);
                  }}
                >
                  {values.interestId !== i.id && <InterestIcon slug={i.slug} />}
                  {i.name}
                </Chip>
              ))}
            </div>
          </Sheet>
        </div>
      }
      preview={
        <>
          <ActivityPreview interest={chosen} title={values.title} host={host} />
          <p className="mt-3 text-[15px] text-slate">One interest per activity in V1.</p>
        </>
      }
      actions={actions}
    />
  );
}
