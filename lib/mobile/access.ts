import type { AuthSession } from "@/lib/auth-session";
import { UserRole } from "@/lib/domain";

const MOBILE_LEGACY_ROLES = new Set<UserRole>([
  UserRole.SUPERVISOR,
  UserRole.SENIOR_SUPERVISOR,
  UserRole.MANAGER,
  UserRole.ADMIN,
  UserRole.DIRECTOR,
]);

/** Roles that may sign in to the mobile monitoring app. */
export function canUseMobileApp(session: AuthSession): boolean {
  if (MOBILE_LEGACY_ROLES.has(session.role)) return true;

  const globalCode = session.globalRole?.code?.toLowerCase() ?? "";
  if (globalCode === "admin" || globalCode === "director") return true;

  const lineCode = session.commercialServiceRole?.code?.toLowerCase() ?? "";
  if (!lineCode) return false;
  if (lineCode.includes("manager")) return true;
  if (lineCode.includes("supervisor")) return true;

  return false;
}
