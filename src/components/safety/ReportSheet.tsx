"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { TextAreaField } from "@/components/ui/FormField";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { REPORT_NOTE_MAX, REPORT_REASONS } from "@/lib/reports";

/** Report dialog shared by people (S09) and activities (S17): reason + optional note. */
export function ReportSheet({
  open,
  onClose,
  title,
  submit,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  submit: (reason: string, note: string) => Promise<{ error?: string }>;
  onDone: () => void;
}) {
  const toast = useToast();
  const [reason, setReason] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!reason) return;
          startTransition(async () => {
            const result = await submit(reason, note);
            if (result.error) return toast.show(result.error, "error");
            setReason(null);
            setNote("");
            onDone();
          });
        }}
      >
        <fieldset>
          <legend className="text-[13px] font-bold">What&apos;s wrong?</legend>
          <div className="mt-2 flex flex-col">
            {REPORT_REASONS.map((r) => (
              <label key={r.value} className="flex min-h-11 cursor-pointer items-center gap-3 text-[16px]">
                <input
                  type="radio"
                  name="reason"
                  value={r.value}
                  checked={reason === r.value}
                  onChange={() => setReason(r.value)}
                  className="size-5 accent-blue-600"
                />
                {r.label}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="mt-4">
          <TextAreaField
            id="report-note"
            label="Anything else? (optional)"
            rows={3}
            maxLength={REPORT_NOTE_MAX}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            count={{ value: note.length, max: REPORT_NOTE_MAX }}
          />
        </div>
        <Button type="submit" className="mt-5" disabled={!reason || pending}>
          {pending ? "Sending…" : "Send report"}
        </Button>
      </form>
    </Sheet>
  );
}
