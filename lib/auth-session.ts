import type { UserRole } from "@prisma/client";

export const AUTH_STORAGE_KEY = "po_auth_session";

/** @deprecated Dummy-login only; remove when real auth ships. */
export const LEGACY_DUMMY_USER_KEY = "dummy_user";

export type AuthSalesPoint = {
  id: number;
  name: string;
};

export type AuthSession = {
  username: string;
  role: UserRole;
  salesPoint: AuthSalesPoint | null;
};

export function parseAuthSession(raw: string | null): AuthSession | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as unknown;
    if (!data || typeof data !== "object") return null;
    const o = data as Record<string, unknown>;
    if (typeof o.username !== "string" || !o.username.trim()) return null;
    if (typeof o.role !== "string") return null;
    let salesPoint: AuthSalesPoint | null = null;
    if (o.salesPoint != null && typeof o.salesPoint === "object") {
      const sp = o.salesPoint as Record<string, unknown>;
      if (typeof sp.id === "number" && typeof sp.name === "string") {
        salesPoint = { id: sp.id, name: sp.name };
      }
    }
    return {
      username: o.username.trim(),
      role: o.role as UserRole,
      salesPoint,
    };
  } catch {
    return null;
  }
}
