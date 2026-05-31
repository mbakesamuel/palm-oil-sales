import "server-only";

import type { AuthSession } from "@/lib/auth-session";
import { getPrismaClient } from "@/lib/prisma";
import { prismaRetry } from "@/lib/prisma-retry";
import { getServerSession } from "@/lib/auth-server";
import { UserRole } from "@/lib/domain";
import { PERMISSION_KEYS, type PermissionKey } from "@/lib/access-control-keys";
import {
  permissionKeysForModules,
  type CommercialModuleKey,
} from "@/lib/commercial-modules";
import {
  isRouteEnabledByProfile,
  loadCommercialProfileForSession,
  type CommercialProfile,
} from "@/lib/commercial-profile";
import { resolveRoutePermissionKey } from "@/lib/resolve-route-permission";
import { roleSeesAllCommercialServices } from "@/lib/service-scope";
import { redirect } from "next/navigation";

export { PERMISSION_KEYS, type PermissionKey };

export type RolePermissionMap = Record<PermissionKey, boolean>;

function grantMobileApiAccess(base: RolePermissionMap, role: UserRole): void {
  const allowed =
    role === UserRole.ADMIN ||
    role === UserRole.DIRECTOR ||
    role === UserRole.MANAGER ||
    role === UserRole.SENIOR_SUPERVISOR ||
    role === UserRole.SUPERVISOR;
  if (allowed) {
    base["route:/api/mobile/v1"] = true;
  }
}

/** Palm-oil report routes (`palm_reports` module), aligned with `defaultPermissionsForRole`. */
function grantPalmOilReportRoutes(base: RolePermissionMap) {
  const mod: CommercialModuleKey = "palm_reports";
  for (const key of permissionKeysForModules([mod])) {
    base[key] = true;
  }
}

/** DB rows seeded before palm report defaults must not block keys that are true in code defaults. */
function mergeStoredPermissions(
  defaults: RolePermissionMap,
  rows: Array<{ key: string; allowed: boolean }>,
): RolePermissionMap {
  const out: RolePermissionMap = { ...defaults };
  for (const r of rows) {
    if (!(PERMISSION_KEYS as readonly string[]).includes(r.key)) continue;
    const key = r.key as PermissionKey;
    out[key] = r.allowed || defaults[key];
  }
  return out;
}

export function defaultPermissionsForRole(role: UserRole): RolePermissionMap {
  const base: RolePermissionMap = Object.fromEntries(
    PERMISSION_KEYS.map((k) => [k, false]),
  ) as RolePermissionMap;

  // Keep existing UX: operations are available to everyone by default.
  base["route:/dashboard"] = true;
  base["route:/dashboard/executive"] =
    role === UserRole.ADMIN || role === UserRole.DIRECTOR;
  base["route:/delivery-orders"] = true;
  base["route:/delivery-orders/list"] = true;
  base["route:/delivery-orders/validation-queue"] = role === UserRole.MANAGER;
  base["route:/pos"] = true;
  base["route:/pos/list"] = true;
  base["route:/bpo-sales"] = true;
  base["route:/stock"] = true;

  // Stock posting defaults: clerks DRAFT receipts/transfers and confirm receipts at the
  // destination, but POSTING a receipt and DISPATCHING a transfer is the supervisor-level
  // validation step (mirrors how sales invoices are drafted by clerks and validated by
  // supervisors). Only the supervisor responsible for the sales point may post/dispatch
  // for that point. Senior supervisors roam across sales points and therefore do NOT
  // post/dispatch themselves — they would defer to the sales-point supervisor.
  if (role === UserRole.CLERK) {
    base["ui:receive-stock-transfer"] = true;
  }
  if (role === UserRole.SUPERVISOR) {
    base["ui:post-stock-receipt"] = true;
    base["ui:dispatch-stock-transfer"] = true;
    base["ui:receive-stock-transfer"] = true;
  }
  if (role === UserRole.SENIOR_SUPERVISOR) {
    // Senior supervisors still confirm receipt of inbound transfers when
    // standing in at a destination point, but never post receipts or dispatch
    // outbound transfers in place of the sales-point supervisor.
    base["ui:receive-stock-transfer"] = true;
  }
  if (role === UserRole.MANAGER) {
    // Line managers roam across sales points; validate DOs and adjust stock, but do not
    // post receipts or dispatch transfers in place of the sales-point supervisor.
    base["ui:receive-stock-transfer"] = true;
    base["ui:post-stock-adjustment"] = true;
    base["ui:reclassify-stock-condition"] = true;
    base["ui:validate-delivery-orders"] = true;
  }
  if (
    role === UserRole.SUPERVISOR ||
    role === UserRole.SENIOR_SUPERVISOR ||
    role === UserRole.DIRECTOR
  ) {
    base["ui:post-stock-adjustment"] = true;
  }
  if (role === UserRole.DIRECTOR) {
    base["ui:reclassify-stock-condition"] = true;
  }

  // Vehicle consignment notes: clerks draft, supervisors validate (admin gets all keys below).
  if (role === UserRole.CLERK || role === UserRole.SUPERVISOR) {
    base["route:/consignment-notes"] = true;
  }

  if (role === UserRole.DIRECTOR) {
    base["route:/setup/sales-budget"] = true;
  }

  // Reports default on (palm_reports + shared BPO report entry points).
  grantPalmOilReportRoutes(base);
  base["route:/reports/bpo-pricing"] = true;
  base["route:/reports/bpo"] = true;
  base["route:/reports/bpo-sales-crosstab"] =
    role === UserRole.ADMIN ||
    role === UserRole.DIRECTOR ||
    role === UserRole.SENIOR_SUPERVISOR;

  // Clerks draft; supervisors validate sales invoices. Leadership may override.
  base["ui:validate-documents"] =
    role === UserRole.ADMIN ||
    role === UserRole.DIRECTOR ||
    role === UserRole.SUPERVISOR;

  base["ui:validate-delivery-orders"] =
    role === UserRole.DIRECTOR || role === UserRole.MANAGER;

  grantMobileApiAccess(base, role);

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

  // Codes that should be treated as supervisor-equivalent for stock posting/dispatch
  // (i.e. allowed to validate clerk drafts). Sales clerks (`clerk`, `factory_clerk`)
  // intentionally do NOT match. Roles that include "senior" are also excluded:
  // senior supervisors roam across multiple sales points and defer post/dispatch to
  // the supervisor of each sales point itself.
  const isSupervisorEquivalent =
    !c.includes("senior") &&
    (c.includes("supervisor") ||
      c.includes("manager") ||
      c.includes("director") ||
      c.includes("in_charge") ||
      c === "bpo_clerk");

  if (c.includes("factory")) {
    base["route:/factories"] = true;
    base["route:/rubber"] = true;
    base["route:/stock"] = true;
    base["ui:receive-stock-transfer"] = true;
    if (isSupervisorEquivalent) {
      base["ui:post-stock-receipt"] = true;
      base["ui:dispatch-stock-transfer"] = true;
    }
    base["route:/reports"] = true;
    base["route:/reports/sales"] = true;
    if (c.includes("manager")) {
      base["ui:validate-delivery-orders"] = true;
      base["ui:post-stock-adjustment"] = true;
      base["ui:reclassify-stock-condition"] = true;
    } else if (c.includes("supervisor")) {
      base["ui:validate-documents"] = true;
      base["ui:post-stock-adjustment"] = true;
    }
    return base;
  }

  // Palm-style service roles (fallback).
  base["route:/delivery-orders"] = true;
  base["route:/delivery-orders/list"] = true;
  base["route:/delivery-orders/validation-queue"] = c.includes("manager");
  base["route:/pos"] = true;
  base["route:/pos/list"] = true;
  base["route:/stock"] = true;
  base["ui:receive-stock-transfer"] = true;
  if (isSupervisorEquivalent) {
    base["ui:post-stock-receipt"] = true;
    base["ui:dispatch-stock-transfer"] = true;
  }
  base["route:/reports"] = true;
  base["route:/reports/sales"] = true;
  grantPalmOilReportRoutes(base);
  if (c.includes("bpo")) {
    base["route:/bpo-sales"] = true;
    base["route:/reports/bpo"] = true;
    base["route:/reports/bpo-pricing"] = true;
    base["route:/reports/bpo-sales-crosstab"] = true;
  }
  if (c.includes("supervisor") || c.includes("manager")) {
    base["route:/consignment-notes"] = true;
    base["ui:post-stock-adjustment"] = true;
  }
  if (c.includes("senior") && c.includes("supervisor")) {
    // senior duties only — no sales invoice validation
  } else if (c.includes("supervisor")) {
    base["ui:validate-documents"] = true;
  }
  if (c.includes("manager") || c.includes("director")) {
    base["ui:reclassify-stock-condition"] = true;
  }
  if (c.includes("manager")) {
    base["ui:validate-delivery-orders"] = true;
  }
  if (
    c.includes("supervisor") ||
    c.includes("manager") ||
    c.includes("director")
  ) {
    base["route:/api/mobile/v1"] = true;
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
  if (c.includes("director")) {
    base["route:/dashboard/executive"] = true;
    base["route:/setup/sales-budget"] = true;
    base["ui:validate-documents"] = true;
    base["ui:validate-delivery-orders"] = true;
    base["ui:reclassify-stock-condition"] = true;
  } else if (c.includes("supervisor") && !c.includes("senior")) {
    base["ui:validate-documents"] = true;
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

  return mergeStoredPermissions(defaults, rows);
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

  return mergeStoredPermissions(defaults, rows);
}

function applyCommercialModuleFilter(
  perms: RolePermissionMap,
  profile: CommercialProfile | null,
): RolePermissionMap {
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

  if (roleSeesAllCommercialServices(session.role) || session.globalRole) {
    return perms;
  }
  const profile = await loadCommercialProfileForSession(session);
  return applyCommercialModuleFilter(perms, profile);
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

  return mergeStoredPermissions(defaults, rows);
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
  if (!roleSeesAllCommercialServices(session.role) && !session.globalRole) {
    const profile = await loadCommercialProfileForSession(session);
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
  await assertPermissionKeyForSession(session, key);
}

/** Same checks as assertPermissionKey but for Bearer/mobile or explicit session. */
export async function assertPermissionKeyForSession(
  session: AuthSession,
  key: PermissionKey,
): Promise<void> {
  if (!roleSeesAllCommercialServices(session.role) && !session.globalRole) {
    const profile = await loadCommercialProfileForSession(session);
    if (!isRouteEnabledByProfile(profile, key)) {
      throw new Error("This feature is not enabled for your commercial line.");
    }
  }
  const perms = await getPermissionsForSession(session);
  if (!perms[key]) {
    throw new Error("You do not have permission to perform this action.");
  }
}

