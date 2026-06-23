import "server-only";

import type { AuthSession } from "@/lib/auth-session";
import { getPrismaClient } from "@/lib/prisma";
import { prismaRetry } from "@/lib/prisma-retry";
import { getServerSession } from "@/lib/auth-server";
import { UserRole } from "@/lib/domain";
import { PERMISSION_KEYS, type PermissionKey } from "@/lib/access-control-keys";
import {
  permissionKeysForModules,
  effectiveEnabledModules,
  type CommercialModuleKey,
} from "@/lib/commercial-modules";
import {
  isRouteEnabledByProfile,
  loadCommercialProfileForSession,
  type CommercialProfile,
} from "@/lib/commercial-profile";
import { resolveRoutePermissionKey } from "@/lib/resolve-route-permission";
import {
  canCreateOrEditDeliveryOrderDraft,
  effectiveSessionRole,
} from "@/lib/auth-roles";
import { roleSeesAllCommercialServices } from "@/lib/service-scope";
import {
  defaultLineRoleCodeForUserRole,
  emptyPermissionMap,
  snapshotForGlobalRole,
  snapshotForLegacyUserRole,
  snapshotForLineRoleCode,
  type RolePermissionMap,
} from "@/lib/permission-seed-snapshot";
import { redirect } from "next/navigation";

export { PERMISSION_KEYS, type PermissionKey };
export type { RolePermissionMap };

function permissionsFromDbRows(
  rows: Array<{ key: string; allowed: boolean }>,
): RolePermissionMap {
  const out = emptyPermissionMap();
  for (const r of rows) {
    if (!(PERMISSION_KEYS as readonly string[]).includes(r.key)) continue;
    out[r.key as PermissionKey] = r.allowed;
  }
  return out;
}

/** DB rows override seed defaults; keys missing from DB keep snapshot defaults. */
function mergePermissionsWithSeed(
  seed: RolePermissionMap,
  rows: Array<{ key: string; allowed: boolean }>,
): RolePermissionMap {
  const out = { ...seed };
  for (const r of rows) {
    if (!(PERMISSION_KEYS as readonly string[]).includes(r.key)) continue;
    out[r.key as PermissionKey] = r.allowed;
  }
  return out;
}

export async function getPermissionsForGlobalRoleDefinition(
  globalRoleDefinitionId: string,
): Promise<RolePermissionMap> {
  const prisma = getPrismaClient();
  const def = await prisma.globalRoleDefinition.findUnique({
    where: { id: globalRoleDefinitionId },
    select: { id: true, code: true, legacyRole: true, isActive: true },
  });
  if (!def?.isActive) {
    throw new Error("Global role not found.");
  }

  const seed = snapshotForGlobalRole(
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
    { retries: 3, baseDelayMs: 200 },
  );

  if (rows.length === 0) {
    await prismaRetry(
      () =>
        prisma.globalRolePermission.createMany({
          data: PERMISSION_KEYS.map((key) => ({
            globalRoleDefinitionId,
            key,
            allowed: seed[key],
          })),
          skipDuplicates: true,
        }),
      { retries: 3, baseDelayMs: 200 },
    );
    return seed;
  }

  const perms = mergePermissionsWithSeed(seed, rows);
  // Built-in Admin must never be locked out by partial DB rows (common after permission migrations).
  if (def.legacyRole === UserRole.ADMIN) {
    for (const k of PERMISSION_KEYS) perms[k] = true;
  }
  return perms;
}

async function resolveGlobalRoleDefinitionId(
  session: AuthSession,
): Promise<string | null> {
  const prisma = getPrismaClient();
  if (session.globalRole?.id) {
    const linked = await prisma.globalRoleDefinition.findUnique({
      where: { id: session.globalRole.id },
      select: { id: true, isActive: true },
    });
    if (linked?.isActive) return linked.id;
  }
  if (!roleSeesAllCommercialServices(session.role)) return null;
  const def = await prisma.globalRoleDefinition.findFirst({
    where: { legacyRole: session.role, isActive: true },
    select: { id: true },
  });
  return def?.id ?? null;
}

async function resolveLineRoleForSession(
  session: AuthSession,
): Promise<{ id: string; code: string } | null> {
  if (session.commercialServiceRole) {
    return {
      id: session.commercialServiceRole.id,
      code: session.commercialServiceRole.code,
    };
  }
  const serviceId = session.commercialService?.id;
  if (!serviceId) return null;
  const code = defaultLineRoleCodeForUserRole(session.role);
  if (!code) return null;
  const prisma = getPrismaClient();
  const role = await prisma.commercialServiceRole.findFirst({
    where: { commercialServiceId: serviceId, code, isActive: true },
    select: { id: true, code: true },
  });
  return role ?? null;
}

export async function getPermissionsForServiceRole(
  commercialServiceRoleId: string,
  roleCode: string,
): Promise<RolePermissionMap> {
  const prisma = getPrismaClient();
  const seed = snapshotForLineRoleCode(roleCode);
  const rows = await prismaRetry(
    () =>
      prisma.commercialServiceRolePermission.findMany({
        where: {
          commercialServiceRoleId,
          key: { in: [...PERMISSION_KEYS] },
        },
        select: { key: true, allowed: true },
      }),
    { retries: 3, baseDelayMs: 200 },
  );

  if (rows.length === 0) {
    await prismaRetry(
      () =>
        prisma.commercialServiceRolePermission.createMany({
          data: PERMISSION_KEYS.map((key) => ({
            commercialServiceRoleId,
            key,
            allowed: seed[key],
          })),
          skipDuplicates: true,
        }),
      { retries: 3, baseDelayMs: 200 },
    );
    return seed;
  }

  return mergePermissionsWithSeed(seed, rows);
}

/** One query for all global roles — used by Setup → Permissions role picker. */
export async function getPermissionsBatchForGlobalRoles(): Promise<
  Record<string, RolePermissionMap>
> {
  const prisma = getPrismaClient();
  const defs = await prisma.globalRoleDefinition.findMany({
    where: { isActive: true },
    select: { id: true, code: true, legacyRole: true },
  });
  if (defs.length === 0) return {};

  const rows = await prismaRetry(
    () =>
      prisma.globalRolePermission.findMany({
        where: {
          globalRoleDefinitionId: { in: defs.map((d) => d.id) },
          key: { in: [...PERMISSION_KEYS] },
        },
        select: { globalRoleDefinitionId: true, key: true, allowed: true },
      }),
    { retries: 3, baseDelayMs: 200 },
  );

  const rowsByRole = new Map<string, Array<{ key: string; allowed: boolean }>>();
  for (const r of rows) {
    const list = rowsByRole.get(r.globalRoleDefinitionId) ?? [];
    list.push({ key: r.key, allowed: r.allowed });
    rowsByRole.set(r.globalRoleDefinitionId, list);
  }

  const out: Record<string, RolePermissionMap> = {};
  for (const def of defs) {
    const seed = snapshotForGlobalRole(
      def.code,
      def.legacyRole as UserRole | null,
    );
    const roleRows = rowsByRole.get(def.id) ?? [];
    if (roleRows.length === 0) {
      out[def.id] = seed;
      continue;
    }
    const perms = permissionsFromDbRows(roleRows);
    if (def.legacyRole === UserRole.ADMIN) {
      for (const k of PERMISSION_KEYS) perms[k] = true;
    }
    out[def.id] = perms;
  }
  return out;
}

/** One query for all line roles on a commercial service — used by Setup → Permissions. */
export async function getPermissionsBatchForLineRoles(
  commercialServiceId: string,
): Promise<Record<string, RolePermissionMap>> {
  const prisma = getPrismaClient();
  const roles = await prisma.commercialServiceRole.findMany({
    where: { commercialServiceId, isActive: true },
    select: { id: true, code: true },
  });
  if (roles.length === 0) return {};

  const rows = await prismaRetry(
    () =>
      prisma.commercialServiceRolePermission.findMany({
        where: {
          commercialServiceRoleId: { in: roles.map((r) => r.id) },
          key: { in: [...PERMISSION_KEYS] },
        },
        select: { commercialServiceRoleId: true, key: true, allowed: true },
      }),
    { retries: 3, baseDelayMs: 200 },
  );

  const rowsByRole = new Map<string, Array<{ key: string; allowed: boolean }>>();
  for (const r of rows) {
    const list = rowsByRole.get(r.commercialServiceRoleId) ?? [];
    list.push({ key: r.key, allowed: r.allowed });
    rowsByRole.set(r.commercialServiceRoleId, list);
  }

  const out: Record<string, RolePermissionMap> = {};
  for (const role of roles) {
    const seed = snapshotForLineRoleCode(role.code);
    const roleRows = rowsByRole.get(role.id) ?? [];
    out[role.id] = roleRows.length === 0 ? seed : permissionsFromDbRows(roleRows);
  }
  return out;
}

function applyCommercialModuleFilter(
  perms: RolePermissionMap,
  profile: CommercialProfile | null,
): RolePermissionMap {
  if (!profile) return perms;
  const allowed = permissionKeysForModules(
    effectiveEnabledModules(profile.enabledModules),
  );
  const out = { ...perms };
  for (const k of PERMISSION_KEYS) {
    if (k.startsWith("route:") && !allowed.has(k)) {
      out[k] = false;
    }
  }
  return out;
}

/** Draft delivery orders — DB permission with legacy senior-supervisor fallback. */
export function canDraftDeliveryOrders(
  perms: RolePermissionMap,
  session: Pick<AuthSession, "role" | "commercialServiceRole">,
): boolean {
  if (perms["ui:draft-delivery-orders"]) return true;
  return canCreateOrEditDeliveryOrderDraft(
    effectiveSessionRole(session),
    session.commercialServiceRole?.code ?? null,
  );
}

export async function getPermissionsForSession(
  session: AuthSession,
): Promise<RolePermissionMap> {
  let perms: RolePermissionMap;

  const globalRoleId = await resolveGlobalRoleDefinitionId(session);
  if (globalRoleId) {
    perms = await getPermissionsForGlobalRoleDefinition(globalRoleId);
  } else {
    const lineRole = await resolveLineRoleForSession(session);
    if (lineRole) {
      perms = await getPermissionsForServiceRole(lineRole.id, lineRole.code);
    } else if (roleSeesAllCommercialServices(session.role)) {
      perms = snapshotForLegacyUserRole(session.role);
    } else {
      console.error(
        `[access-control] User ${session.userId} has no global or line role definition assigned.`,
      );
      return emptyPermissionMap();
    }
  }

  if (roleSeesAllCommercialServices(session.role) || globalRoleId) {
    return perms;
  }
  const profile = await loadCommercialProfileForSession(session);
  return applyCommercialModuleFilter(perms, profile);
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
  const normalized = pathname.replace(/\/+$/, "") || "/";
  const key = resolveRoutePermissionKey(pathname);
  if (!key) return true;
  if (!roleSeesAllCommercialServices(session.role) && !session.globalRole) {
    const profile = await loadCommercialProfileForSession(session);
    if (!isRouteEnabledByProfile(profile, pathname)) return false;
  }
  const perms = await getPermissionsForSession(session);
  if (perms[key]) return true;

  if (
    normalized === "/setup/permissions" ||
    normalized.startsWith("/setup/permissions/")
  ) {
    return Boolean(
      perms["route:/setup/permissions"] || perms["route:/setup/role-access"],
    );
  }

  return false;
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

/** True when the session has a permission key (and commercial module, when applicable). */
export async function isPermissionKeyAllowedForSession(
  session: AuthSession,
  key: PermissionKey,
): Promise<boolean> {
  if (!roleSeesAllCommercialServices(session.role) && !session.globalRole) {
    const profile = await loadCommercialProfileForSession(session);
    if (!isRouteEnabledByProfile(profile, key)) return false;
  }
  const perms = await getPermissionsForSession(session);
  return Boolean(perms[key]);
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
  if (!(await isPermissionKeyAllowedForSession(session, key))) {
    if (!roleSeesAllCommercialServices(session.role) && !session.globalRole) {
      const profile = await loadCommercialProfileForSession(session);
      if (!isRouteEnabledByProfile(profile, key)) {
        throw new Error("This feature is not enabled for your commercial line.");
      }
    }
    throw new Error("You do not have permission to perform this action.");
  }
}

/** Server pages: redirect to `/forbidden` instead of throwing into the error boundary. */
export async function assertPermissionKeyOrRedirect(
  key: PermissionKey,
): Promise<void> {
  const session = await getServerSession();
  if (!session?.userId) redirect("/login");
  if (!(await isPermissionKeyAllowedForSession(session, key))) {
    redirect("/forbidden");
  }
}

/** Like `assertPermissionKeyOrRedirect` but checks several keys in one session load. */
export async function assertPermissionKeysOrRedirect(
  ...keys: PermissionKey[]
): Promise<void> {
  const session = await getServerSession();
  if (!session?.userId) redirect("/login");
  for (const key of keys) {
    if (!(await isPermissionKeyAllowedForSession(session, key))) {
      redirect("/forbidden");
    }
  }
}
