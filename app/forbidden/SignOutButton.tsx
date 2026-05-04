"use client";

import * as React from "react";

export function SignOutButton() {
  const [busy, setBusy] = React.useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => {
        setBusy(true);
        void fetch("/api/auth/logout", { method: "POST" })
          .catch(() => {})
          .finally(() => {
            window.location.href = "/login";
          });
      }}
      className="text-sm underline underline-offset-4 bg-transparent border-0 cursor-pointer p-0 font-inherit disabled:opacity-50"
    >
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}
