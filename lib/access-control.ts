import "server-only";

import { getPrismaClient } from "@/lib/prisma";
import { getServerSession } from "@/lib/auth-server";
import { UserRole } from "@/lib/domain";
import { PERMISSION_KEYS, type PermissionKey } from "@/lib/access-control-keys";

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
  // Operational: same users who receive stock need tank/location setup in the sidebar.
  base["route:/storage-locations"] = true;

  // Reports default on.
  base["route:/reports/sales"] = true;
  base["route:/reports/delivery-orders"] = true;
  base["route:/reports/delivery-order-monitor"] = true;
  base["route:/reports/customer-delivery-monitor"] = true;
  base["route:/reports/do-commitment-crosstab"] = true;
  base["route:/reports/stock-on-hand"] = true;

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
  const rows = await prisma.rolePermission.findMany({
    where: { role, key: { in: [...PERMISSION_KEYS] } },
    select: { key: true, allowed: true },
  });

  // If no rows exist yet, lazily seed defaults for this role.
  if (rows.length === 0) {
    await prisma.rolePermission.createMany({
      data: PERMISSION_KEYS.map((key) => ({
        role,
        key,
        allowed: defaults[key],
      })),
      skipDuplicates: true,
    });
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

