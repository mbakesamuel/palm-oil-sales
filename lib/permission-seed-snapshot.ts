/**
 * Static permission defaults used only when seeding DB rows (new roles, reset, migration).
 * Runtime access always reads GlobalRolePermission / CommercialServiceRolePermission.
 */
import { PERMISSION_KEYS, type PermissionKey } from "@/lib/access-control-keys";
import {
  permissionKeysForModules,
  type CommercialModuleKey,
} from "@/lib/commercial-modules";
import { UserRole } from "@/lib/domain";

export type RolePermissionMap = Record<PermissionKey, boolean>;

export function emptyPermissionMap(): RolePermissionMap {
  return Object.fromEntries(
    PERMISSION_KEYS.map((k) => [k, false]),
  ) as RolePermissionMap;
}

function grantPalmOilReportRoutes(base: RolePermissionMap) {
  const mod: CommercialModuleKey = "palm_reports";
  for (const key of permissionKeysForModules([mod])) {
    base[key] = true;
  }
}

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

/** Snapshot aligned with former `defaultPermissionsForRole` (legacy User.role). */
export function snapshotForLegacyUserRole(role: UserRole): RolePermissionMap {
  const base = emptyPermissionMap();

  base["route:/dashboard"] = true;
  base["route:/dashboard/executive"] =
    role === UserRole.ADMIN || role === UserRole.DIRECTOR;
  base["route:/delivery-orders"] = true;
  base["route:/delivery-orders/list"] = true;
  base["route:/delivery-orders/validation-queue"] =
    role === UserRole.MANAGER || role === UserRole.DIRECTOR;
  base["route:/pos"] = true;
  base["route:/pos/list"] = true;
  base["route:/stock"] = true;

  if (role === UserRole.CLERK) {
    base["ui:receive-stock-transfer"] = true;
  }
  if (role === UserRole.SUPERVISOR) {
    base["ui:post-stock-receipt"] = true;
    base["ui:dispatch-stock-transfer"] = true;
    base["ui:receive-stock-transfer"] = true;
  }
  if (role === UserRole.SENIOR_SUPERVISOR) {
    base["ui:receive-stock-transfer"] = true;
    base["ui:draft-delivery-orders"] = true;
    base["ui:validate-documents"] = true;
  }
  if (role === UserRole.MANAGER) {
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

  if (role === UserRole.CLERK || role === UserRole.SUPERVISOR) {
    base["route:/consignment-notes"] = true;
  }

  if (role === UserRole.DIRECTOR) {
    base["route:/setup/sales-budget"] = true;
  }

  base["route:/reports"] = true;
  base["route:/reports/sales"] = true;
  grantPalmOilReportRoutes(base);

  base["ui:validate-documents"] =
    role === UserRole.ADMIN ||
    role === UserRole.DIRECTOR ||
    role === UserRole.SUPERVISOR;

  base["ui:validate-delivery-orders"] =
    role === UserRole.DIRECTOR || role === UserRole.MANAGER;

  grantMobileApiAccess(base, role);

  if (role === UserRole.ADMIN) {
    for (const k of PERMISSION_KEYS) base[k] = true;
  }

  return base;
}

/** Snapshot for a commercial line role code (known templates). */
export function snapshotForLineRoleCode(code: string): RolePermissionMap {
  const base = emptyPermissionMap();

  base["route:/dashboard"] = true;
  base["route:/customers"] = true;
  base["route:/products"] = true;
  base["route:/product-categories"] = true;

  const c = code.toLowerCase();

  const isSupervisorEquivalent =
    !c.includes("senior") &&
    (c.includes("supervisor") ||
      c.includes("manager") ||
      c.includes("director") ||
      c.includes("in_charge"));

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
    if (
      c.includes("supervisor") ||
      c.includes("manager") ||
      c.includes("director")
    ) {
      base["route:/api/mobile/v1"] = true;
    }
    return base;
  }

  base["route:/delivery-orders"] = true;
  base["route:/delivery-orders/list"] = true;
  base["route:/delivery-orders/validation-queue"] =
    c.includes("manager") || c.includes("director");
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
  if (c.includes("supervisor") || c.includes("manager")) {
    base["route:/consignment-notes"] = true;
    base["ui:post-stock-adjustment"] = true;
  }
  if (c.includes("senior") && c.includes("supervisor")) {
    base["ui:draft-delivery-orders"] = true;
    base["ui:validate-documents"] = true;
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

/** Minimal defaults for a newly created custom line role. */
export function minimalLineRoleSnapshot(): RolePermissionMap {
  const base = emptyPermissionMap();
  base["route:/dashboard"] = true;
  return base;
}

/** Snapshot for global role definitions. */
export function snapshotForGlobalRole(
  code: string,
  legacyRole: UserRole | null,
): RolePermissionMap {
  if (legacyRole) {
    return snapshotForLegacyUserRole(legacyRole);
  }
  const base = emptyPermissionMap();
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
    base["route:/api/mobile/v1"] = true;
  } else if (c.includes("supervisor") && !c.includes("senior")) {
    base["ui:validate-documents"] = true;
  }
  return base;
}

/** Minimal defaults for a newly created custom global role. */
export function minimalCustomGlobalSnapshot(): RolePermissionMap {
  const base = emptyPermissionMap();
  base["route:/dashboard"] = true;
  base["route:/reports"] = true;
  base["route:/reports/sales"] = true;
  return base;
}

/** Maps User.role to default line role code when backfilling assignments. */
export function defaultLineRoleCodeForUserRole(role: UserRole): string | null {
  switch (role) {
    case UserRole.CLERK:
      return "clerk";
    case UserRole.SUPERVISOR:
      return "supervisor";
    case UserRole.SENIOR_SUPERVISOR:
      return "senior_supervisor";
    case UserRole.MANAGER:
      return "manager";
    default:
      return null;
  }
}
