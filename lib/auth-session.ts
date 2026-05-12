import type { UserRole } from "@/lib/domain";

export const AUTH_STORAGE_KEY = "po_auth_session";

/** @deprecated Dummy-login only; remove when real auth ships. */
export const LEGACY_DUMMY_USER_KEY = "dummy_user";

export type AuthSalesPoint = {
  id: number;
  name: string;
};

export type AuthSession = {
  userId: string;
  username: string;
  /** Shown in the shell (from `User.name` at login). */
  displayName: string;
  role: UserRole;
  salesPoint: AuthSalesPoint | null;
  /** Optional sub-unit / service line (from `User.service`). */
  service: string | null;
};

export function parseAuthSession(raw: string | null): AuthSession | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as unknown;
    if (!data || typeof data !== "object") return null;
    const o = data as Record<string, unknown>;
    if (typeof o.userId !== "string" || !o.userId.trim()) return null;
    if (typeof o.username !== "string" || !o.username.trim()) return null;
    if (typeof o.role !== "string") return null;
    const displayName =
      typeof o.displayName === "string" && o.displayName.trim()
        ? o.displayName.trim()
        : o.username.trim();
    let salesPoint: AuthSalesPoint | null = null;
    if (o.salesPoint != null && typeof o.salesPoint === "object") {
      const sp = o.salesPoint as Record<string, unknown>;
      if (typeof sp.id === "number" && typeof sp.name === "string") {
        salesPoint = { id: sp.id, name: sp.name };
      }
    }
    let service: string | null = null;
    if (typeof o.service === "string" && o.service.trim() !== "") {
      service = o.service.trim();
    }
    return {
      userId: o.userId.trim(),
      username: o.username.trim(),
      displayName,
      role: o.role as UserRole,
      salesPoint,
      service,
    };
  } catch {
    return null;
  }
}
