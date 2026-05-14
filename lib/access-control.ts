import "server-only";

import { getPrismaClient } from "@/lib/prisma";
import { prismaRetry } from "@/lib/prisma-retry";
import { getServerSession } from "@/lib/auth-server";
import { UserRole } from "@/lib/domain";
import { PERMISSION_KEYS, type PermissionKey } from "@/lib/access-control-keys";
import { resolveRoutePermissionKey } from "@/lib/resolve-route-permission";
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
  base["route:/stock/receive"] = true;
  base["route:/stock/bpo-receive"] = true;
  base["route:/stock/bpo-consignments"] = true;
  base["route:/stock/bpo-outbound"] = true;
  // Operational: same users who receive stock need tank/location setup in the sidebar.
  base["route:/storage-locations"] = true;

  // Vehicle consignment notes: clerks draft, supervisors validate (admin gets all keys below).
  if (role === UserRole.CLERK || role === UserRole.SUPERVISOR) {
    base["route:/consignment-notes"] = true;
  }

  if (role === UserRole.CLERK_IN_CHARGE_BPO) {
    base["route:/stock/bpo-receive"] = true;
    base["route:/stock/bpo-consignments"] = true;
    base["route:/stock/bpo-outbound"] = true;
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

  // Validation buttons visible to supervisors and above (still server-enforced elsewhere).
  base["ui:validate-documents"] =
    role === UserRole.ADMIN ||
    role === UserRole.DIRECTOR ||
    role === UserRole.MANAGER ||
    role === UserRole.SENIOR_SUPERVISOR ||
    role === UserRole.SUPERVISOR;

  // Setup defaults: admin only.
  const isAdmin = role === UserRole.ADMIN;
  if (isAdmin) {
    for (const k of PERMISSION_KEYS) base[k] = true;
    return base;
  }

  return base;
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

/** True when the role may open this pathname (no matching `route:*` key → allowed). */
export async function isRouteAllowedForPath(
  pathname: string,
  role: UserRole,
): Promise<boolean> {
  const key = resolveRoutePermissionKey(pathname);
  if (!key) return true;
  const perms = await getPermissionsForRole(role);
  return Boolean(perms[key]);
}

/** Server-only: block direct URL access when the role lacks `route:*` permission. */
export async function assertRouteAllowedForPath(pathname: string, role: UserRole): Promise<void> {
  if (!(await isRouteAllowedForPath(pathname, role))) {
    redirect("/forbidden");
  }
}

/** For server actions / APIs: same rules as `route:*` page access (throws if denied). */
export async function assertPermissionKey(key: PermissionKey): Promise<void> {
  const session = await getServerSession();
  if (!session?.userId) {
    throw new Error("Login required.");
  }
  const perms = await getPermissionsForRole(session.role);
  if (!perms[key]) {
    throw new Error("You do not have permission to perform this action.");
  }
}

