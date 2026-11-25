"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { CircleCheck, CircleAlert } from "lucide-react";
import { countdown } from "@/lib/time";

type Undo = { label?: string; onUndo: () => void; durationMs: number };
type Toast = { id: number; message: string; tone: "success" | "error"; undo?: Undo };
type ToastApi = { show: (message: string, tone?: Toast["tone"], undo?: Undo) => void };

const ToastContext = createContext<ToastApi>({ show: () => {} });

const DURATION_MS = 4000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const show = useCallback((message: string, tone: Toast["tone"] = "success", undo?: Undo) => {
    const id = nextId.current++;
    setToasts((t) => [...t.slice(-2), { id, message, tone, undo }]);
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {/* Sits above the mobile bottom bar. */}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 bottom-[calc(96px+env(safe-area-inset-bottom))] z-50 flex flex-col items-center gap-2 md:bottom-8"
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDone={() => setToasts((all) => all.filter((x) => x.id !== t.id))} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onDone }: { toast: Toast; onDone: () => void }) {
  const duration = toast.undo?.durationMs ?? DURATION_MS;
  const [left, setLeft] = useState(duration);
  // The provider passes a new onDone each render; keep the timer anchored to mount.
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  });
  useEffect(() => {
    const end = Date.now() + duration;
    const timer = setTimeout(() => done.current(), duration);
    const tick = toast.undo ? setInterval(() => setLeft(end - Date.now()), 250) : undefined;
    return () => {
      clearTimeout(timer);
      clearInterval(tick);
    };
  }, [duration, toast.undo]);
  const Icon = toast.tone === "success" ? CircleCheck : CircleAlert;
  return (
    <div
      role="status"
      className="pointer-events-auto flex max-w-[520px] items-center gap-3 rounded-input bg-charcoal px-4 py-3 text-[15px] leading-[21px] text-white shadow-card-hover"
    >
      <Icon
        size={20}
        strokeWidth={1.8}
        aria-hidden="true"
        className={`shrink-0 self-start mt-px ${toast.tone === "success" ? "text-toast-check" : "text-danger-tint"}`}
      />
      <span className="min-w-0 flex-1">{toast.message}</span>
      {toast.undo && (
        <button
          type="button"
          onClick={() => {
            toast.undo!.onUndo();
            onDone();
          }}
          className="-my-1.5 -mr-2 inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-3 font-bold text-toast-check hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white"
        >
          {toast.undo.label ?? "Undo"}
          <span className="font-medium text-white/70 tabular-nums" aria-hidden="true">
            {countdown(left)}
          </span>
        </button>
      )}
    </div>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
