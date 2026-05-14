"use client";

import * as React from "react";
import { LogOut } from "lucide-react";

type SignOutButtonProps = {
  /** `icon`: compact control for narrow / icon-rail sidebars */
  variant?: "text" | "icon";
};

export function SignOutButton({ variant = "text" }: SignOutButtonProps) {
  const [busy, setBusy] = React.useState(false);
  const label = busy ? "Signing out…" : "Sign out";

  if (variant === "icon") {
    return (
      <button
        type="button"
        disabled={busy}
        aria-label={label}
        title={label}
        onClick={async () => {
          setBusy(true);
          try {
            await fetch("/api/auth/logout", {
              method: "POST",
              credentials: "include",
              cache: "no-store",
            });
          } catch {
            // ignore
          } finally {
            window.location.href = "/login";
          }
        }}
        className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md border border-border bg-transparent hover:bg-foreground/5 disabled:opacity-50 cursor-pointer"
      >
        <LogOut className="size-5" aria-hidden />
        <span className="sr-only">{label}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await fetch("/api/auth/logout", {
            method: "POST",
            credentials: "include",
            cache: "no-store",
          });
        } catch {
          // ignore
        } finally {
          window.location.href = "/login";
        }
      }}
      className="inline-flex items-center gap-1.5 bg-transparent border-0 cursor-pointer p-0 text-left text-sm font-inherit disabled:opacity-50"
    >
      <LogOut className="size-4 shrink-0 opacity-80" aria-hidden />
      <span className="underline underline-offset-4">{label}</span>
    </button>
  );
}
