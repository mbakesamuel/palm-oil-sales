"use client";

import * as React from "react";
import type { AuthSession } from "@/lib/auth-session";

type AuthStatus = "loading" | "ready";

type AuthContextValue = {
  status: AuthStatus;
  session: AuthSession | null;
  signIn: (session: AuthSession) => void;
  signOut: () => Promise<void>;
};

const AuthContext = React.createContext<AuthContextValue | null>(null);

async function fetchSession(): Promise<AuthSession | null> {
  const r = await fetch("/api/auth/session", {
    cache: "no-store",
    credentials: "include",
  });
  if (!r.ok) return null;
  const data = (await r.json()) as { session: AuthSession | null };
  return data.session ?? null;
}

/** Poll interval inside the sliding session window (see `AUTH_SESSION_MAX_AGE` / auth.config). */
const SESSION_POLL_MS = 10 * 60 * 1000;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Keep initial render deterministic for SSR + hydration.
  const [status, setStatus] = React.useState<AuthStatus>("loading");
  const [session, setSession] = React.useState<AuthSession | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    const applySession = (s: AuthSession | null) => {
      if (!cancelled) setSession(s);
    };

    const touchSession = () => {
      void fetchSession().then((s) => {
        applySession(s);
        if (!cancelled) setStatus("ready");
      });
    };

    touchSession();

    const onVisibility = () => {
      if (document.visibilityState === "visible") touchSession();
    };
    document.addEventListener("visibilitychange", onVisibility);

    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      touchSession();
    }, SESSION_POLL_MS);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearInterval(id);
    };
  }, []);

  const signIn = React.useCallback((next: AuthSession) => {
    setSession(next);
  }, []);

  const signOut = React.useCallback(async () => {
    setSession(null);
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
      });
    } catch {
      // If the network fails, keep local state signed out anyway.
    }
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
