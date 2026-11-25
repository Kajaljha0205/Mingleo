"use client";

import { useActionState, useState } from "react";
import { OnboardingActions } from "@/components/onboarding/OnboardingShell";
import { Button } from "@/components/ui/Button";
import { TextAreaField, TextField } from "@/components/ui/FormField";
import { Switch } from "@/components/ui/Switch";
import {
  BIO_MAX,
  FIRST_NAME_MAX,
  formatBirthdayInput,
  underageBirthDate,
  UNDERAGE_MESSAGE,
  validateBio,
  validateBirthday,
  validateFirstName,
} from "@/lib/validation";
import { saveAbout, type AboutState } from "../actions";

type Props = {
  from?: string;
  saveLabel?: string;
  initial: { firstName: string; birthday: string; showAge: boolean; bio: string };
};

const BIRTHDAY_LENGTH = "DD / MM / YYYY".length;

export function AboutForm({ from, saveLabel = "Continue", initial }: Props) {
  const [state, action, pending] = useActionState<AboutState, FormData>(saveAbout, { errors: {} });
  const [firstName, setFirstName] = useState(initial.firstName);
  const [birthday, setBirthday] = useState(initial.birthday);
  const [showAge, setShowAge] = useState(initial.showAge);
  const [bio, setBio] = useState(initial.bio);

  const birthdayComplete = birthday.length === BIRTHDAY_LENGTH;
  const underage = birthdayComplete && underageBirthDate(birthday) !== null;
  const birthdayError = underage
    ? `${UNDERAGE_MESSAGE} If you continue, your account will be deleted.`
    : birthdayComplete
      ? validateBirthday(birthday)
      : null;
  const canContinue =
    underage ||
    (!validateFirstName(firstName) && birthdayComplete && !birthdayError && !validateBio(bio));

  return (
    <form action={action} noValidate className="flex flex-1 flex-col">
      {from && <input type="hidden" name="from" value={from} />}
      <div className="mt-6 flex flex-col gap-5">
        <TextField
          id="firstName"
          name="firstName"
          label="First name"
          autoComplete="given-name"
          maxLength={FIRST_NAME_MAX}
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          error={state.errors.firstName}
          required
        />
        <TextField
          id="birthday"
          name="birthday"
          label="Birthday"
          placeholder="DD / MM / YYYY"
          inputMode="numeric"
          autoComplete="bday"
          value={birthday}
          onChange={(e) => setBirthday(formatBirthdayInput(e.target.value))}
          error={birthdayError ?? state.errors.birthday}
          required
        />
        <Switch
          id="showAge"
          name="showAge"
          label="Show my age on profile"
          description="You can change this any time"
          checked={showAge}
          onChange={setShowAge}
        />
        <TextAreaField
          id="bio"
          name="bio"
          label="Short bio"
          rows={3}
          maxLength={BIO_MAX}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          count={{ value: bio.length, max: BIO_MAX }}
          error={state.errors.bio}
        />
      </div>
      {state.errors.form && (
        <p role="alert" className="mt-4 text-[14px] font-semibold text-danger">
          {state.errors.form}
        </p>
      )}
      <OnboardingActions>
        <Button type="submit" variant={underage ? "danger" : "primary"} disabled={!canContinue || pending}>
          {pending ? "Saving…" : underage ? "Delete my account" : saveLabel}
        </Button>
      </OnboardingActions>
    </form>
  );
}
