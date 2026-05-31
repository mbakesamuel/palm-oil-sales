import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { MobileLoginResponse, MobileMeResponse } from "@pos/shared";
import {
  apiFetch,
  getApiBaseUrl,
  isNetworkError,
  networkErrorMessage,
  parseJsonResponse,
  setApiTokens,
  subscribeApiTokens,
} from "@/api/client";
import { clearStoredTokens, loadStoredTokens, saveStoredTokens } from "@/auth/storage";

type AuthState = {
  loading: boolean;
  session: MobileMeResponse["session"] | null;
  permissions: string[];
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  hasPermission: (key: string) => boolean;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<MobileMeResponse["session"] | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);

  const refreshProfile = useCallback(async () => {
    const me = await apiFetch<MobileMeResponse>("/api/mobile/v1/me");
    setSession(me.session);
    setPermissions(me.permissions);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = await loadStoredTokens();
        if (stored) {
          setApiTokens(stored);
          await refreshProfile();
        }
      } catch {
        await clearStoredTokens();
        setApiTokens(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshProfile]);

  useEffect(() => {
    return subscribeApiTokens(async (tokens) => {
      if (tokens) await saveStoredTokens(tokens);
      else await clearStoredTokens();
    });
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const base = getApiBaseUrl();
    let res: Response;
    try {
      res = await fetch(`${base}/api/mobile/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, deviceLabel: "expo" }),
      });
    } catch (e) {
      if (isNetworkError(e)) {
        throw new Error(networkErrorMessage());
      }
      throw e;
    }
    const data = await parseJsonResponse<MobileLoginResponse>(res);
    if (!res.ok) {
      throw new Error(data.error ?? "Login failed.");
    }
    setApiTokens(data.tokens);
    await saveStoredTokens(data.tokens);
    setSession(data.session);
    setPermissions(data.permissions);
  }, []);

  const logout = useCallback(async () => {
    try {
      const stored = await loadStoredTokens();
      if (stored?.refreshToken) {
        await fetch(`${getApiBaseUrl()}/api/mobile/v1/auth/logout`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken: stored.refreshToken }),
        });
      }
    } finally {
      setApiTokens(null);
      await clearStoredTokens();
      setSession(null);
      setPermissions([]);
    }
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      loading,
      session,
      permissions,
      login,
      logout,
      refreshProfile,
      hasPermission: (key) => permissions.includes(key),
    }),
    [loading, session, permissions, login, logout, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
