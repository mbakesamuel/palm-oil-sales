"use client";

import * as React from "react";
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
        return;
      }
      signIn(r.session);
      router.push("/dashboard");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={(e) => void onSubmit(e)}
      className="rounded-2xl border border-black/10 dark:border-white/10 p-6 space-y-4"
    >
      <div className="space-y-2 pb-4 border-b border-black/10 dark:border-white/10">
        <div className="relative flex min-h-10 items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element -- SVG from /public */}
          <img
            src={logoSrc}
            alt=""
            className="absolute left-0 top-1/2 h-9 max-h-9 w-auto max-w-[80px] -translate-y-1/2 object-contain"
          />
          <div className="w-full px-16 text-center">
            <div className="text-lg font-semibold leading-tight">{companyName.trim()}</div>
            {department?.trim() ? (
              <div className="text-sm font-medium opacity-80 mt-0.5">{department.trim()}</div>
            ) : null}
          </div>
        </div>
      </div>
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Sign in</h1>
        <p className="text-sm opacity-75">
          Enter the username and password issued by your administrator. Sessions use{" "}
          <span className="font-medium">Auth.js</span> (JWT).
        </p>
      </div>

      <div className="grid gap-2">
        <label className="text-sm font-medium" htmlFor="username">
          Username
        </label>
        <input
          id="username"
          autoComplete="username"
          className="rounded-md border border-black/10 dark:border-white/10 bg-transparent px-3 py-2"
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
          className="rounded-md border border-black/10 dark:border-white/10 bg-transparent px-3 py-2"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>

      {error ? <div className="text-sm text-red-600 dark:text-red-400">{error}</div> : null}

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-md bg-black text-white dark:bg-white dark:text-black px-4 py-2 text-sm font-medium disabled:opacity-50"
      >
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
