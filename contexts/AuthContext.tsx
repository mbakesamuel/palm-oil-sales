"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import * as React from "react";
import { UserRole } from "@/lib/domain";
import type { AuthSession } from "@/lib/auth-session";
import { AUTH_STORAGE_KEY, LEGACY_DUMMY_USER_KEY, parseAuthSession } from "@/lib/auth-session";

type AuthStatus = "loading" | "ready";

type AuthContextValue = {
  status: AuthStatus;
  session: AuthSession | null;
  signIn: (session: AuthSession) => void;
  signOut: () => void;
};

const AuthContext = React.createContext<AuthContextValue | null>(null);

function readSessionFromStorage(): AuthSession | null {
  if (typeof window === "undefined") return null;
  try {
    const next = parseAuthSession(localStorage.getItem(AUTH_STORAGE_KEY));
    if (next) return next;
    const legacy = localStorage.getItem(LEGACY_DUMMY_USER_KEY);
    if (legacy?.trim()) {
      const u = legacy.trim();
      return {
        userId: "legacy",
        username: u,
        displayName: u,
        role: UserRole.ADMIN,
        salesPoint: null,
      };
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Keep initial render deterministic for SSR + hydration.
  const [status, setStatus] = React.useState<AuthStatus>("loading");
  const [session, setSession] = React.useState<AuthSession | null>(null);

  React.useEffect(() => {
    setSession(readSessionFromStorage());
    setStatus("ready");
  }, []);

  const signIn = React.useCallback((next: AuthSession) => {
    try {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(next));
      localStorage.removeItem(LEGACY_DUMMY_USER_KEY);
    } catch {
      /* ignore */
    }
    setSession(next);
  }, []);

  const signOut = React.useCallback(() => {
    try {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      localStorage.removeItem(LEGACY_DUMMY_USER_KEY);
    } catch {
      /* ignore */
    }
    setSession(null);
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
