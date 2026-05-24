import "server-only";

import type { AuthSession } from "@/lib/auth-session";
import { getPrismaClient } from "@/lib/prisma";
import { prismaRetry } from "@/lib/prisma-retry";
import { getServerSession } from "@/lib/auth-server";
import { UserRole } from "@/lib/domain";
import { PERMISSION_KEYS, type PermissionKey } from "@/lib/access-control-keys";
import { permissionKeysForModules } from "@/lib/commercial-modules";
import { isRouteEnabledByProfile, resolveCommercialProfile } from "@/lib/commercial-profile";
import { resolveRoutePermissionKey } from "@/lib/resolve-route-permission";
import { roleSeesAllCommercialServices } from "@/lib/service-scope";
import { redirect } from "next/navigation";

export { PERMISSION_KEYS, type PermissionKey };

export type RolePermissionMap = Record<PermissionKey, boolean>;

export function defaultPermissionsForRole(role: UserRole): RolePermissionMap {
  const base: RolePermissionMap = Object.fromEntries(
    PERMISSION_KEYS.map((k) => [k, false]),
  ) as RolePermissionMap;

  // Keep existing UX: operations are available to everyone by default.
  base["route:/dashboard"] = true;
  base["route:/delivery-orders"] = true;
  base["route:/pos"] = true;
  base["route:/bpo-sales"] = true;
  base["route:/stock"] = true;
  base["route:/stock/receipts"] = true;
  base["route:/stock/movements"] = true;
  base["route:/stock/issues"] = true;
  base["route:/stock/receive"] = true;
  base["route:/stock/bpo-receive"] = true;
  base["route:/stock/bpo-consignments"] = true;
  base["route:/stock/bpo-outbound"] = true;
  // Legacy keys alias to unified stock module (redirects preserve old URLs).
  // Operational: same users who receive stock need tank/location setup in the sidebar.
  base["route:/storage-locations"] = true;

  // Vehicle consignment notes: clerks draft, supervisors validate (admin gets all keys below).
  if (role === UserRole.CLERK || role === UserRole.SUPERVISOR) {
    base["route:/consignment-notes"] = true;
  }

  if (role === UserRole.CLERK_IN_CHARGE_BPO) {
    base["route:/stock"] = true;
    base["route:/stock/bpo-receive"] = true;
    base["route:/stock/bpo-consignments"] = true;
    base["route:/stock/bpo-outbound"] = true;
    base["route:/bpo-sales"] = true;
    base["route:/reports"] = true;
    base["route:/reports/bpo"] = true;
  }

  if (role === UserRole.DIRECTOR || role === UserRole.MANAGER) {
    base["route:/setup/sales-budget"] = true;
  }

  // Reports default on.
  base["route:/reports"] = true;
  base["route:/reports/sales"] = true;
  base["route:/reports/daily-sales-summary"] = true;
  base["route:/reports/delivery-orders"] = true;
  base["route:/reports/delivery-order-monitor"] = true;
  base["route:/reports/customer-delivery-monitor"] = true;
  base["route:/reports/do-commitment-crosstab"] = true;
  base["route:/reports/stock-on-hand"] = true;
  base["route:/reports/stock-vs-commitments"] = true;
  base["route:/reports/sales-budget-monthly-crosstab"] = true;
  base["route:/reports/sales-budget-weekly-crosstab"] = true;
  base["route:/reports/pricing"] = true;
  base["route:/reports/bpo-pricing"] = true;
  base["route:/reports/bpo"] = true;
  base["route:/reports/bpo-sales-crosstab"] =
    role === UserRole.ADMIN ||
    role === UserRole.DIRECTOR ||
    role === UserRole.MANAGER ||
    role === UserRole.SENIOR_SUPERVISOR ||
    role === UserRole.CLERK_IN_CHARGE_BPO;
  base["route:/reports/bpo-stock-cross"] =
    role === UserRole.ADMIN ||
    role === UserRole.DIRECTOR ||
    role === UserRole.MANAGER ||
    role === UserRole.SENIOR_SUPERVISOR ||
    role === UserRole.CLERK_IN_CHARGE_BPO;

  // Clerks draft; supervisors validate sales invoices. Leadership may override.
  base["ui:validate-documents"] =
    role === UserRole.ADMIN ||
    role === UserRole.DIRECTOR ||
    role === UserRole.MANAGER ||
    role === UserRole.SUPERVISOR;

  base["ui:validate-delivery-orders"] = role === UserRole.MANAGER;

  // Setup defaults: admin only.
  const isAdmin = role === UserRole.ADMIN;
  if (isAdmin) {
    for (const k of PERMISSION_KEYS) base[k] = true;
    return base;
  }

  return base;
}

export function defaultPermissionsForServiceRoleCode(code: string): RolePermissionMap {
  const base: RolePermissionMap = Object.fromEntries(
    PERMISSION_KEYS.map((k) => [k, false]),
  ) as RolePermissionMap;

  base["route:/dashboard"] = true;
  base["route:/customers"] = true;
  base["route:/products"] = true;
  base["route:/product-categories"] = true;

  const c = code.toLowerCase();

  if (c.includes("factory")) {
    base["route:/factories"] = true;
    base["route:/rubber"] = true;
    base["route:/reports"] = true;
    base["route:/reports/sales"] = true;
    if (c.includes("manager")) {
      base["ui:validate-delivery-orders"] = true;
    } else if (c.includes("supervisor")) {
      base["ui:validate-documents"] = true;
    }
    return base;
  }

  // Palm-style service roles (fallback).
  base["route:/delivery-orders"] = true;
  base["route:/pos"] = true;
  base["route:/stock"] = true;
  base["route:/stock/receive"] = true;
  base["route:/storage-locations"] = true;
  base["route:/reports"] = true;
  base["route:/reports/sales"] = true;
  if (c.includes("bpo")) {
    base["route:/bpo-sales"] = true;
    base["route:/stock/bpo-receive"] = true;
    base["route:/reports/bpo"] = true;
  }
  if (c.includes("supervisor") || c.includes("manager")) {
    base["route:/consignment-notes"] = true;
  }
  if (c.includes("senior") && c.includes("supervisor")) {
    // senior duties only — no sales invoice validation
  } else if (c.includes("supervisor")) {
    base["ui:validate-documents"] = true;
  }
  if (c.includes("manager")) {
    base["ui:validate-delivery-orders"] = true;
  }
  return base;
}

/** Default route/UI permissions for a global role code (built-in or custom). */
export function defaultPermissionsForGlobalRoleCode(
  code: string,
  legacyRole: UserRole | null,
): RolePermissionMap {
  if (legacyRole) {
    return defaultPermissionsForRole(legacyRole);
  }
  const base: RolePermissionMap = Object.fromEntries(
    PERMISSION_KEYS.map((k) => [k, false]),
  ) as RolePermissionMap;
  base["route:/dashboard"] = true;
  base["route:/reports"] = true;
  base["route:/reports/sales"] = true;

  const c = code.toLowerCase();
  if (c === "admin") {
    for (const k of PERMISSION_KEYS) base[k] = true;
    return base;
  }
  if (c.includes("director") || c.includes("manager") || c.includes("officer")) {
    base["route:/setup/sales-budget"] = true;
    base["ui:validate-documents"] = true;
  } else if (c.includes("supervisor") && !c.includes("senior")) {
    base["ui:validate-documents"] = true;
  }
  if (c.includes("manager")) {
    base["ui:validate-delivery-orders"] = true;
  }
  return base;
}

export async function getPermissionsForGlobalRoleDefinition(
  globalRoleDefinitionId: string,
  fallbackRole?: UserRole,
): Promise<RolePermissionMap> {
  const prisma = getPrismaClient();
  const def = await prisma.globalRoleDefinition.findUnique({
    where: { id: globalRoleDefinitionId },
    select: { id: true, code: true, legacyRole: true, isActive: true },
  });
  if (!def?.isActive) {
    if (fallbackRole) {
      return getPermissionsForRole(fallbackRole);
    }
    throw new Error("Global role not found.");
  }

  const defaults = defaultPermissionsForGlobalRoleCode(
    def.code,
    def.legacyRole as UserRole | null,
  );

  const rows = await prismaRetry(
    () =>
      prisma.globalRolePermission.findMany({
        where: {
          globalRoleDefinitionId,
          key: { in: [...PERMISSION_KEYS] },
        },
        select: { key: true, allowed: true },
      }),
    { retries: 6, baseDelayMs: 300 },
  );

  if (rows.length === 0) {
    await prismaRetry(
      () =>
        prisma.globalRolePermission.createMany({
          data: PERMISSION_KEYS.map((key) => ({
            globalRoleDefinitionId,
            key,
            allowed: defaults[key],
          })),
          skipDuplicates: true,
        }),
      { retries: 6, baseDelayMs: 300 },
    );
    return defaults;
  }

  const out: RolePermissionMap = { ...defaults };
  for (const r of rows) {
    if ((PERMISSION_KEYS as readonly string[]).includes(r.key)) {
      out[r.key as PermissionKey] = r.allowed;
    }
  }
  return out;
}

export async function getPermissionsForServiceRole(
  commercialServiceRoleId: string,
  roleCode: string,
): Promise<RolePermissionMap> {
  const prisma = getPrismaClient();
  const defaults = defaultPermissionsForServiceRoleCode(roleCode);
  const rows = await prismaRetry(
    () =>
      prisma.commercialServiceRolePermission.findMany({
        where: {
          commercialServiceRoleId,
          key: { in: [...PERMISSION_KEYS] },
        },
        select: { key: true, allowed: true },
      }),
    { retries: 6, baseDelayMs: 300 },
  );

  if (rows.length === 0) {
    await prismaRetry(
      () =>
        prisma.commercialServiceRolePermission.createMany({
          data: PERMISSION_KEYS.map((key) => ({
            commercialServiceRoleId,
            key,
            allowed: defaults[key],
          })),
          skipDuplicates: true,
        }),
      { retries: 6, baseDelayMs: 300 },
    );
    return defaults;
  }

  const out: RolePermissionMap = { ...defaults };
  for (const r of rows) {
    if ((PERMISSION_KEYS as readonly string[]).includes(r.key)) {
      out[r.key as PermissionKey] = r.allowed;
    }
  }
  return out;
}

function applyCommercialModuleFilter(
  perms: RolePermissionMap,
  session: AuthSession,
): RolePermissionMap {
  if (roleSeesAllCommercialServices(session.role) || session.globalRole) {
    return perms;
  }
  const profile = resolveCommercialProfile(session);
  if (!profile) return perms;
  const allowed = permissionKeysForModules(profile.enabledModules);
  const out = { ...perms };
  for (const k of PERMISSION_KEYS) {
    if (k.startsWith("route:") && !allowed.has(k)) {
      out[k] = false;
    }
  }
  return out;
}

export async function getPermissionsForSession(
  session: AuthSession,
): Promise<RolePermissionMap> {
  const perms = session.globalRole
    ? await getPermissionsForGlobalRoleDefinition(session.globalRole.id, session.role)
    : session.commercialServiceRole
      ? await getPermissionsForServiceRole(
          session.commercialServiceRole.id,
          session.commercialServiceRole.code,
        )
      : await getPermissionsForRole(session.role);
  return applyCommercialModuleFilter(perms, session);
}

export async function getPermissionsForRole(role: UserRole): Promise<RolePermissionMap> {
  const prisma = getPrismaClient();

  const defaults = defaultPermissionsForRole(role);
  // Hot path: runs on every request via the app layout guard.
  // Neon/pooled TLS can intermittently throw ECONNRESET; retry a bit more than default.
  const rows = await prismaRetry(
    () =>
      prisma.rolePermission.findMany({
        where: { role, key: { in: [...PERMISSION_KEYS] } },
        select: { key: true, allowed: true },
      }),
    { retries: 6, baseDelayMs: 300 },
  );

  // If no rows exist yet, lazily seed defaults for this role.
  if (rows.length === 0) {
    await prismaRetry(
      () =>
        prisma.rolePermission.createMany({
          data: PERMISSION_KEYS.map((key) => ({
            role,
            key,
            allowed: defaults[key],
          })),
          skipDuplicates: true,
        }),
      { retries: 6, baseDelayMs: 300 },
    );
    return defaults;
  }

  const out: RolePermissionMap = { ...defaults };
  for (const r of rows) {
    if ((PERMISSION_KEYS as readonly string[]).includes(r.key)) {
      out[r.key as PermissionKey] = r.allowed;
    }
  }
  return out;
}

export async function assertActorIsAdmin() {
  const session = await getServerSession();
  if (!session?.userId) {
    throw new Error("Login required.");
  }
  if (session.role !== UserRole.ADMIN) {
    throw new Error("Only administrators can manage access control.");
  }
}

/** True when the session may open this pathname (no matching `route:*` key → allowed). */
export async function isRouteAllowedForPath(
  pathname: string,
  session: AuthSession,
): Promise<boolean> {
  const key = resolveRoutePermissionKey(pathname);
  if (!key) return true;
  if (!roleSeesAllCommercialServices(session.role)) {
    const profile = resolveCommercialProfile(session);
    if (!isRouteEnabledByProfile(profile, pathname)) return false;
  }
  const perms = await getPermissionsForSession(session);
  return Boolean(perms[key]);
}

/** Server-only: block direct URL access when the session lacks `route:*` permission. */
export async function assertRouteAllowedForPath(
  pathname: string,
  session: AuthSession,
): Promise<void> {
  if (!(await isRouteAllowedForPath(pathname, session))) {
    redirect("/forbidden");
  }
}

/** For server actions / APIs: same rules as `route:*` page access (throws if denied). */
export async function assertPermissionKey(key: PermissionKey): Promise<void> {
  const session = await getServerSession();
  if (!session?.userId) {
    throw new Error("Login required.");
  }
  if (!roleSeesAllCommercialServices(session.role)) {
    const profile = resolveCommercialProfile(session);
    if (!isRouteEnabledByProfile(profile, key)) {
      throw new Error("This feature is not enabled for your commercial line.");
    }
  }
  const perms = await getPermissionsForSession(session);
  if (!perms[key]) {
    throw new Error("You do not have permission to perform this action.");
  }
}

