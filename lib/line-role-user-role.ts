import { UserRole } from "@/lib/domain";

/**
 * Maps a commercial line role code to `User.role` for workflow rules (validation, BPO, DO, etc.).
 * Permissions for line staff come from `CommercialServiceRolePermission`, not this enum alone.
 *
 * Aligned with default codes from `ensureDefaultServiceRolesForCommercialService`:
 * clerk, supervisor, bpo_clerk, factory_clerk, factory_supervisor, factory_manager, and custom codes.
 */
export function userRoleFromLineRoleCode(code: string): UserRole {
  const c = String(code ?? "")
    .trim()
    .toLowerCase();

  if (c.includes("bpo")) return UserRole.CLERK_IN_CHARGE_BPO;
  if (c.includes("senior") && c.includes("supervisor")) return UserRole.SENIOR_SUPERVISOR;
  // Factory site managers supervise one factory like a supervisor.
  if (c.includes("factory") && c.includes("manager")) return UserRole.SUPERVISOR;
  // Line/site managers (commercial service staff) — validate DOs, reclassify stock, etc.
  if (c.includes("manager")) return UserRole.MANAGER;
  if (c.includes("supervisor")) return UserRole.SUPERVISOR;
  if (c.includes("clerk")) return UserRole.CLERK;

  return UserRole.CLERK;
}
