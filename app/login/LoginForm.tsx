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
      router.push("/dashboard");
    } catch {
      setError("Something went wrong. Please try again.");
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={(e) => void onSubmit(e)}
      aria-busy={busy}
      className="rounded-2xl border border-border p-6 space-y-4"
    >
      <div className="space-y-2 pb-4 border-b border-border">
        <div className="relative flex min-h-10 items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element -- SVG from /public */}
          <img
            src={logoSrc}
            alt=""
            className="absolute left-0 top-1/2 h-9 max-h-9 w-auto max-w-[80px] -translate-y-1/2 object-contain"
          />
          <div className="w-full px-16 text-center">
            <div className="text-md font-semibold leading-tight">
              {companyName.trim()}
            </div>
            <div className="text-sm font-medium opacity-80 mt-0.5">Sales Management Application</div>
            {/*  {department?.trim() ? (
              <div className="text-sm font-medium opacity-80 mt-0.5">
                {department.trim()}
              </div>
            ) : null} */}
          </div>
        </div>
      </div>
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Sign in</h1>
        <p className="text-sm opacity-75">
          Enter the username and password issued by your administrator.
        </p>
      </div>

      <div className="grid gap-2">
        <label className="text-sm font-medium" htmlFor="username">
          Username
        </label>
        <input
          id="username"
          autoComplete="username"
          disabled={busy}
          className="rounded-md border border-border bg-transparent px-3 py-2 disabled:opacity-50"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
      </div>

      <div className="grid gap-2">
        <label className="text-sm font-medium" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          disabled={busy}
          className="rounded-md border border-border bg-transparent px-3 py-2 disabled:opacity-50"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>

      {error ? (
        <div className="text-sm text-red-600 dark:text-red-400">{error}</div>
      ) : null}

      <button
        type="submit"
        disabled={busy}
        className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-medium text-brand-foreground disabled:opacity-50"
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
