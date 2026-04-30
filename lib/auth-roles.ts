import { UserRole } from "@/lib/domain";

/** Roles that must have a fixed sales point on the user record (assigned by admin). */
export function roleRequiresSalesPoint(role: UserRole): boolean {
  return role === UserRole.CLERK || role === UserRole.SUPERVISOR;
}

/** Roles allowed to validate sales invoices and delivery orders (dummy ACL until real auth). */
export function canValidateDocuments(role: UserRole): boolean {
  return (
    role === UserRole.ADMIN ||
    role === UserRole.DIRECTOR ||
    role === UserRole.MANAGER ||
    role === UserRole.SENIOR_SUPERVISOR ||
    role === UserRole.SUPERVISOR
  );
}
