import type { UserRole } from "@/lib/domain";

export const AUTH_STORAGE_KEY = "po_auth_session";

/** @deprecated Dummy-login only; remove when real auth ships. */
export const LEGACY_DUMMY_USER_KEY = "dummy_user";

export type AuthSalesPoint = {
  id: number;
  name: string;
};

export type AuthCommercialService = {
  id: string;
  name: string;
  invoicePrefix: string;
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
  /** Structured commercial line for invoices / letterhead when assigned. */
  commercialService: AuthCommercialService | null;
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
    let commercialService: AuthCommercialService | null = null;
    const cs = o.commercialService;
    if (
      cs &&
      typeof cs === "object" &&
      typeof (cs as Record<string, unknown>).id === "string" &&
      typeof (cs as Record<string, unknown>).name === "string" &&
      typeof (cs as Record<string, unknown>).invoicePrefix === "string"
    ) {
      const r = cs as Record<string, unknown>;
      commercialService = {
        id: String(r.id).trim(),
        name: String(r.name).trim(),
        invoicePrefix: String(r.invoicePrefix).trim(),
      };
    }
    return {
      userId: o.userId.trim(),
      username: o.username.trim(),
      displayName,
      role: o.role as UserRole,
      salesPoint,
      service,
      commercialService,
    };
  } catch {
    return null;
  }
}
