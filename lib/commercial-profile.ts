import "server-only";

import type { AuthSession } from "@/lib/auth-session";
import type { PermissionKey } from "@/lib/access-control-keys";
import type { CommercialSiteKind } from "@/lib/domain-commercial";
import {
  type CommercialModuleKey,
  effectiveEnabledModules,
  routePermissionKeyEnabledForModules,
  parseEnabledModulesJson,
  PALM_OIL_MODULE_KEYS,
  RUBBER_MODULE_KEYS,
} from "@/lib/commercial-modules";
import { resolveRoutePermissionKey } from "@/lib/resolve-route-permission";
import { getPrismaClient } from "@/lib/prisma";
export type CommercialProfile = {
  commercialServiceId: string;
  code: string;
  name: string;
  siteKind: CommercialSiteKind;
  enabledModules: CommercialModuleKey[];
};

export function siteLabelForKind(siteKind: CommercialSiteKind): "Sales point" | "Factory" {
  return siteKind === "FACTORY" ? "Factory" : "Sales point";
}

export function defaultModulesForSiteKind(siteKind: CommercialSiteKind): CommercialModuleKey[] {
  return siteKind === "FACTORY" ? [...RUBBER_MODULE_KEYS] : [...PALM_OIL_MODULE_KEYS];
}

export function profileFromCommercialService(row: {
  id: string;
  code: string;
  name: string;
  siteKind: CommercialSiteKind;
  enabledModules: unknown;
}): CommercialProfile {
  const modules = parseEnabledModulesJson(row.enabledModules);
  return {
    commercialServiceId: row.id,
    code: row.code,
    name: row.name,
    siteKind: row.siteKind,
    enabledModules: modules.length > 0 ? modules : defaultModulesForSiteKind(row.siteKind),
  };
}

export function resolveCommercialProfile(session: AuthSession): CommercialProfile | null {
  const cs = session.commercialService;
  if (!cs) return null;
  const siteKind = cs.siteKind ?? "SALES_POINT";
  const modules =
    cs.enabledModules && cs.enabledModules.length > 0
      ? cs.enabledModules
      : defaultModulesForSiteKind(siteKind);
  return {
    commercialServiceId: cs.id,
    code: cs.code,
    name: cs.name,
    siteKind,
    enabledModules: modules,
  };
}

/** Module list from DB so route gates are not blocked by a stale JWT `enabledModules`. */
export async function loadCommercialProfileForSession(
  session: AuthSession,
): Promise<CommercialProfile | null> {
  const fallback = resolveCommercialProfile(session);
  const serviceId = fallback?.commercialServiceId ?? session.commercialService?.id;
  if (!serviceId) return fallback;

  const row = await getPrismaClient().commercialService.findUnique({
    where: { id: serviceId },
    select: {
      id: true,
      code: true,
      name: true,
      siteKind: true,
      enabledModules: true,
      isActive: true,
    },
  });
  if (!row?.isActive) return fallback;
  return profileFromCommercialService(row);
}

export function isModuleEnabled(
  profile: CommercialProfile | null,
  moduleKey: CommercialModuleKey,
): boolean {
  if (!profile) return true;
  return profile.enabledModules.includes(moduleKey);
}

export function isRouteEnabledByProfile(
  profile: CommercialProfile | null,
  pathnameOrPermissionKey: string,
): boolean {
  if (!profile) return true;
  const key = pathnameOrPermissionKey.startsWith("route:")
    ? (pathnameOrPermissionKey as PermissionKey)
    : resolveRoutePermissionKey(pathnameOrPermissionKey);
  if (!key) return true;
  return routePermissionKeyEnabledForModules(key, profile.enabledModules);
}

export function commercialServiceErrorForModule(
  profile: CommercialProfile | null,
  pathnameOrPermissionKey: string,
): string | null {
  if (!profile) return null;
  if (isRouteEnabledByProfile(profile, pathnameOrPermissionKey)) return null;
  return "This feature is not enabled for your commercial line.";
}
