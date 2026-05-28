"use client";

import * as React from "react";
import { useBranding } from "@/components/BrandingProvider";

export type ConfirmDialogProps = {
  title: string;
  description: string;
  children?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Default `danger` (red). Use `neutral` for confirmations that are not destructive. */
  confirmTone?: "danger" | "neutral";
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
};

export function ConfirmDialog(props: ConfirmDialogProps) {
  const {
    title,
    description,
    children,
    confirmLabel = "Delete",
    cancelLabel = "Cancel",
    confirmTone = "danger",
    onCancel,
    onConfirm,
  } = props;

  const branding = useBranding();
  const brandingEyebrow = [branding.department, branding.companyName].filter(Boolean).join(" · ");

  const [busy, setBusy] = React.useState(false);
  const mountedRef = React.useRef(true);
  const busyRef = React.useRef(false);
  const onCancelRef = React.useRef(onCancel);

  React.useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  React.useEffect(() => {
    onCancelRef.current = onCancel;
  }, [onCancel]);

  React.useEffect(() => {
    busyRef.current = busy;
  }, [busy]);

  React.useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busyRef.current) onCancelRef.current();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  async function handleConfirm() {
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      if (mountedRef.current) setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-100 flex items-end justify-center sm:items-center p-4 sm:p-6">
      <div
        className="absolute inset-0 bg-black/45 dark:bg-black/55 backdrop-blur-[2px]"
        aria-hidden
        onClick={() => {
          if (!busy) onCancel();
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-desc"
        className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-background text-foreground shadow-xl shadow-black/10 dark:shadow-black/40"
      >
        <div className="p-5 sm:p-6 space-y-4">
          <div className="space-y-1.5">
            <div className="text-xs font-semibold uppercase tracking-wide text-foreground/60">
              {brandingEyebrow}
            </div>
            <h2
              id="confirm-dialog-title"
              className="text-lg font-semibold text-foreground"
            >
              {title}
            </h2>
            <p
              id="confirm-dialog-desc"
              className="text-sm text-foreground/80 leading-relaxed"
            >
              {description}
            </p>
          </div>
          {children ? <div className="space-y-2">{children}</div> : null}
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
            <button
              type="button"
              disabled={busy}
              onClick={onCancel}
              className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium hover:bg-accent/25 disabled:opacity-50"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleConfirm()}
              className={[
                "rounded-lg px-4 py-2.5 text-sm font-medium disabled:opacity-50",
                confirmTone === "danger"
                  ? "bg-red-600 text-white hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600"
                  : "bg-brand text-brand-foreground hover:opacity-90",
              ].join(" ")}
            >
              {busy ? "Please wait…" : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
