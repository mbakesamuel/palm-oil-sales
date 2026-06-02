import type { AuthSession } from "@/lib/auth-session";
import { roleSeesAllCommercialServices } from "@/lib/service-scope";

export function isDashboardPath(pathname: string): boolean {
  const path = pathname.trim();
  return path === "/dashboard" || path.startsWith("/dashboard/");
}

/** Post-login and sidebar home dashboard URL for this session. */
export function resolveHomeDashboardPath(session: AuthSession): string {
  if (roleSeesAllCommercialServices(session.role)) {
    return "/dashboard/executive";
  }
  const code = session.commercialService?.code?.trim();
  if (code) return lineDashboardPath(code);
  return "/forbidden";
}

export function lineDashboardPath(serviceCode: string): string {
  return `/dashboard/${encodeURIComponent(serviceCode.trim())}`;
}

export function normalizeServiceCodeParam(raw: string): string {
  return decodeURIComponent(raw).trim().toLowerCase();
}

/** True when the session may open a line-specific dashboard at `/dashboard/{code}`. */
export function canAccessLineDashboard(
  session: AuthSession,
  serviceCode: string,
): boolean {
  const code = normalizeServiceCodeParam(serviceCode);
  if (!code) return false;
  if (roleSeesAllCommercialServices(session.role)) return true;
  const userCode = session.commercialService?.code?.trim().toLowerCase();
  return Boolean(userCode && userCode === code);
}

/** True when the session may open the cross-line executive dashboard. */
export function canAccessExecutiveDashboard(session: AuthSession): boolean {
  return roleSeesAllCommercialServices(session.role);
}

export type LineDashboardVariant = "palm-oil" | "rubber" | "generic";

const VARIANT_BY_SERVICE_CODE: Record<string, LineDashboardVariant> = {
  default: "palm-oil",
  rubber: "rubber",
};

export function lineDashboardVariantForCode(serviceCode: string): LineDashboardVariant {
  const code = normalizeServiceCodeParam(serviceCode);
  return VARIANT_BY_SERVICE_CODE[code] ?? "generic";
}
