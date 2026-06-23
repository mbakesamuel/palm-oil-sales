import { UserRole } from "@/lib/domain";

/**
 * Maps a commercial line role code to `User.role` for workflow rules (validation, DO, etc.).
 * Permissions for line staff come from `CommercialServiceRolePermission`, not this enum alone.
 *
 * Aligned with default codes from `ensureDefaultServiceRolesForCommercialService`:
 * clerk, supervisor, factory_clerk, factory_supervisor, factory_manager, and custom codes.
 */
export function userRoleFromLineRoleCode(code: string): UserRole {
  const c = String(code ?? "")
    .trim()
    .toLowerCase();

  if (c === "sss" || (c.includes("senior") && c.includes("supervisor"))) {
    return UserRole.SENIOR_SUPERVISOR;
  }
  // Factory site managers supervise one factory like a supervisor.
  if (c.includes("factory") && c.includes("manager")) return UserRole.SUPERVISOR;
  // Line/site managers — validate DOs, reclassify stock, etc.
  if (c === "man" || c.includes("manager")) return UserRole.MANAGER;
  if (c === "sas" || c.includes("supervisor")) return UserRole.SUPERVISOR;
  if (c.includes("clerk") || c === "sac" || c === "prc") return UserRole.CLERK;

  return UserRole.CLERK;
}
