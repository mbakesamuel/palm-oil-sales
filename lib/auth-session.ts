import type { UserRole } from "@/lib/domain";
import type { CommercialSiteKind } from "@/lib/domain-commercial";
import type { CommercialModuleKey } from "@/lib/commercial-modules";

export const AUTH_STORAGE_KEY = "po_auth_session";

/** @deprecated Dummy-login only; remove when real auth ships. */
export const LEGACY_DUMMY_USER_KEY = "dummy_user";

export type AuthSalesPoint = {
  id: number;
  name: string;
};

export type AuthFactory = {
  id: string;
  name: string;
};

export type AuthCommercialServiceRole = {
  id: string;
  code: string;
  name: string;
};

export type AuthGlobalRole = {
  id: string;
  code: string;
  displayName: string;
};

export type AuthCommercialService = {
  id: string;
  code: string;
  name: string;
  invoicePrefix: string;
  siteKind: CommercialSiteKind;
  enabledModules: CommercialModuleKey[];
};

export type AuthSession = {
  userId: string;
  username: string;
  /** Shown in the shell (from `User.name` at login). */
  displayName: string;
  role: UserRole;
  /** Org-wide role when assigned (permissions source for leadership / custom global roles). */
  globalRole: AuthGlobalRole | null;
  salesPoint: AuthSalesPoint | null;
  factory: AuthFactory | null;
  /** Optional sub-unit / service line (from `User.service`). */
  service: string | null;
  /** Structured commercial line for invoices / letterhead when assigned. */
  commercialService: AuthCommercialService | null;
  /** Line-specific role (operational users on a commercial service). */
  commercialServiceRole: AuthCommercialServiceRole | null;
};

function parseCommercialService(raw: unknown): AuthCommercialService | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== "string" || typeof r.name !== "string" || typeof r.invoicePrefix !== "string") {
    return null;
  }
  const siteKind =
    r.siteKind === "FACTORY" || r.siteKind === "SALES_POINT" ? r.siteKind : "SALES_POINT";
  let enabledModules: CommercialModuleKey[] = [];
  if (Array.isArray(r.enabledModules)) {
    enabledModules = r.enabledModules.filter((x) => typeof x === "string") as CommercialModuleKey[];
  }
  return {
    id: String(r.id).trim(),
    code: typeof r.code === "string" && r.code.trim() !== "" ? String(r.code).trim() : "",
    name: String(r.name).trim(),
    invoicePrefix: String(r.invoicePrefix).trim(),
    siteKind,
    enabledModules,
  };
}

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
    let factory: AuthFactory | null = null;
    if (o.factory != null && typeof o.factory === "object") {
      const f = o.factory as Record<string, unknown>;
      if (typeof f.id === "string" && typeof f.name === "string") {
        factory = { id: f.id.trim(), name: f.name.trim() };
      }
    }
    let service: string | null = null;
    if (typeof o.service === "string" && o.service.trim() !== "") {
      service = o.service.trim();
    }
    const commercialService = parseCommercialService(o.commercialService);
    let globalRole: AuthGlobalRole | null = null;
    const gr = o.globalRole;
    if (gr && typeof gr === "object") {
      const g = gr as Record<string, unknown>;
      if (
        typeof g.id === "string" &&
        typeof g.code === "string" &&
        typeof g.displayName === "string"
      ) {
        globalRole = {
          id: g.id.trim(),
          code: g.code.trim(),
          displayName: g.displayName.trim(),
        };
      }
    }
    let commercialServiceRole: AuthCommercialServiceRole | null = null;
    const csr = o.commercialServiceRole;
    if (csr && typeof csr === "object") {
      const c = csr as Record<string, unknown>;
      if (typeof c.id === "string" && typeof c.code === "string" && typeof c.name === "string") {
        commercialServiceRole = {
          id: c.id.trim(),
          code: c.code.trim(),
          name: c.name.trim(),
        };
      }
    }
    return {
      userId: o.userId.trim(),
      username: o.username.trim(),
      displayName,
      role: o.role as UserRole,
      globalRole,
      salesPoint,
      factory,
      service,
      commercialService,
      commercialServiceRole,
    };
  } catch {
    return null;
  }
}
