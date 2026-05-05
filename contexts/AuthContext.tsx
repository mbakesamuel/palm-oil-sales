"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import * as React from "react";
import type { AuthSession } from "@/lib/auth-session";

type AuthStatus = "loading" | "ready";

type AuthContextValue = {
  status: AuthStatus;
  session: AuthSession | null;
  signIn: (session: AuthSession) => void;
  signOut: () => void;
};

const AuthContext = React.createContext<AuthContextValue | null>(null);

async function fetchSession(): Promise<AuthSession | null> {
  const r = await fetch("/api/auth/session", { cache: "no-store" });
  if (!r.ok) return null;
  const data = (await r.json()) as { session: AuthSession | null };
  return data.session ?? null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Keep initial render deterministic for SSR + hydration.
  const [status, setStatus] = React.useState<AuthStatus>("loading");
  const [session, setSession] = React.useState<AuthSession | null>(null);

  React.useEffect(() => {
    void fetchSession()
      .then((s) => setSession(s))
      .finally(() => setStatus("ready"));
  }, []);

  const signIn = React.useCallback((next: AuthSession) => {
    setSession(next);
  }, []);

  const signOut = React.useCallback(() => {
    setSession(null);
    void fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
      cache: "no-store",
    });
  }, []);

  const value = React.useMemo(
    () => ({ status, session, signIn, signOut }),
    [status, session, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = React.useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
