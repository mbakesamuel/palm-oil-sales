"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { loginWithCredentials } from "./actions";

export function LoginForm(props: {
  companyName: string;
  department: string | null;
  logoSrc: string;
}) {
  const { companyName, department, logoSrc } = props;
  const router = useRouter();
  const { signIn } = useAuth();

  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const r = await loginWithCredentials(username, password);
      if (!r.ok) {
        setError(r.error);
        setBusy(false);
        return;
      }
      signIn(r.session);
      router.push(r.homePath);
    } catch {
      setError("Something went wrong. Please try again.");
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={(e) => void onSubmit(e)}
      aria-busy={busy}
      className="space-y-5 rounded-2xl border border-border bg-white p-6 shadow-[0_8px_32px_rgb(45_80_22/0.12)]"
    >
      <div className="space-y-3 border-b border-border pb-5">
        <div className="relative flex min-h-10 items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element -- SVG from /public */}
          <img
            src={logoSrc}
            alt=""
            className="absolute left-0 top-1/2 h-9 max-h-9 w-auto max-w-[80px] -translate-y-1/2 object-contain"
          />
          <div className="w-full px-16 text-center">
            <div className="text-base font-semibold leading-tight text-foreground">
              {companyName.trim()}
            </div>
            <div className="mt-0.5 text-sm font-medium text-foreground/70">
              Sales Management Application
            </div>
            {department?.trim() ? (
              <div className="mt-0.5 text-sm text-foreground/60">
                {department.trim()}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-brand">Sign in</h1>
        <p className="text-sm text-foreground/70">
          Enter the username and password issued by your administrator.
        </p>
      </div>

      <div className="grid gap-2">
        <label className="text-sm font-medium text-foreground" htmlFor="username">
          Username
        </label>
        <input
          id="username"
          autoComplete="username"
          disabled={busy}
          className="rounded-lg border border-border bg-white px-3 py-2.5 text-foreground outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/25 disabled:opacity-50"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
      </div>

      <div className="grid gap-2">
        <label className="text-sm font-medium text-foreground" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          disabled={busy}
          className="rounded-lg border border-border bg-white px-3 py-2.5 text-foreground outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/25 disabled:opacity-50"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>

      {error ? (
        <div className="text-sm font-medium text-red-700">{error}</div>
      ) : null}

      <button
        type="submit"
        disabled={busy}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-brand-foreground shadow-md transition hover:opacity-95 disabled:opacity-50"
      >
        {busy ? (
          <>
            <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
            Signing in…
          </>
        ) : (
          "Sign in"
        )}
      </button>
    </form>
  );
}
