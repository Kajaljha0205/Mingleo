"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { EMPTY_DRAFT, type Draft } from "@/lib/activity";

// ST-110: the draft lives in sessionStorage so it survives moving between S12 ↔ S13 (and reloads).
const KEY = "mingleo:create-draft";
const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => e.key === KEY && cb();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

const read = () => sessionStorage.getItem(KEY) ?? "";

function parse(raw: string): Draft {
  try {
    const value = JSON.parse(raw) as Partial<Draft>;
    return { ...EMPTY_DRAFT, ...(value && typeof value === "object" ? value : {}) };
  } catch {
    return EMPTY_DRAFT;
  }
}

function write(next: Draft | null) {
  if (next) sessionStorage.setItem(KEY, JSON.stringify(next));
  else sessionStorage.removeItem(KEY);
  listeners.forEach((l) => l());
}

/** `draft` is null during server render / before hydration. */
export function useDraft() {
  const raw = useSyncExternalStore(subscribe, read, () => null);
  const draft = useMemo(() => (raw === null ? null : parse(raw)), [raw]);
  const update = useCallback((patch: Partial<Draft>) => write({ ...parse(read()), ...patch }), []);
  const clear = useCallback(() => write(null), []);
  return { draft, update, clear };
}
