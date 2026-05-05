import { UserRole } from "@/lib/domain";

/**
 * Roles that must have a fixed sales point on the user record (assigned by admin).
 * Server actions enforce posting scope for these roles via `lib/auth-sales-point-scope`.
 */
export function roleRequiresSalesPoint(role: UserRole): boolean {
  return role === UserRole.CLERK || role === UserRole.SUPERVISOR;
}

/**
 * Roles allowed to validate **sales invoices** (and similar). Delivery orders use
 * {@link canValidateDeliveryOrder} (managers only).
 */
export function canValidateDocuments(role: UserRole): boolean {
  return (
    role === UserRole.ADMIN ||
    role === UserRole.DIRECTOR ||
    role === UserRole.MANAGER ||
    role === UserRole.SENIOR_SUPERVISOR ||
    role === UserRole.SUPERVISOR
  );
}

/** Draft delivery orders: created / edited / deleted while still pending. */
export function canCreateOrEditDeliveryOrderDraft(role: UserRole): boolean {
  return role === UserRole.SENIOR_SUPERVISOR || role === UserRole.ADMIN;
}

/** Validate a pending delivery order after a senior supervisor has prepared it. */
export function canValidateDeliveryOrder(role: UserRole): boolean {
  return role === UserRole.MANAGER || role === UserRole.ADMIN;
}

/** Draft vehicle consignment notes (1:1 with Sale): clerks prepare; supervisors validate. */
export function canCreateOrEditConsignmentNoteDraft(role: UserRole): boolean {
  return role === UserRole.CLERK || role === UserRole.ADMIN;
}

/** Validate a pending vehicle consignment note after a clerk has prepared it. */
export function canValidateConsignmentNote(role: UserRole): boolean {
  return role === UserRole.SUPERVISOR || role === UserRole.ADMIN;
}
