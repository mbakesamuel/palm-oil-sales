import { UserRole } from "@/lib/domain";

export {
  roleRequiresCommercialServiceAssignment,
  roleSeesAllCommercialServices,
} from "@/lib/service-scope";

/**
 * Roles that must have a fixed sales point on the user record (assigned by admin).
 * Server actions enforce posting scope for these roles via `lib/auth-sales-point-scope`.
 */
export function roleRequiresSalesPoint(role: UserRole): boolean {
  return (
    role === UserRole.CLERK ||
    role === UserRole.SUPERVISOR ||
    role === UserRole.CLERK_IN_CHARGE_BPO
  );
}

/** Sales-point staff see delivery orders only after manager validation (reports, load, print, POS lookup). */
export function roleSeesOnlyValidatedDeliveryOrders(role: UserRole): boolean {
  return roleRequiresSalesPoint(role);
}

/**
 * Org-wide roles may record new BPO receipts at a chosen sales point, but must not
 * change existing receipt rows; point-scoped roles may edit/delete their receipts.
 */
export function roleMayMutateBpoReceiveRows(role: UserRole): boolean {
  return roleRequiresSalesPoint(role);
}

/** Only sales clerks raise draft BPO consignment vouchers from the sender depot to Bota. */
export function roleMayRaiseBpoConsignmentSenderVoucher(role: UserRole): boolean {
  return role === UserRole.CLERK;
}

/**
 * Roles allowed to validate **sales invoices** (legacy helper; POS uses
 * permission `ui:validate-documents`). Excludes senior supervisors — they
 * draft DOs / BPO workflows; line supervisors validate clerk invoices.
 */
export function canValidateDocuments(role: UserRole): boolean {
  return (
    role === UserRole.ADMIN ||
    role === UserRole.DIRECTOR ||
    role === UserRole.MANAGER ||
    role === UserRole.SUPERVISOR
  );
}

/** BPO consignment sender validation and related stock/BPO actions. */
export function canValidateBpoDocuments(role: UserRole): boolean {
  return (
    canValidateDocuments(role) ||
    role === UserRole.SENIOR_SUPERVISOR ||
    role === UserRole.CLERK_IN_CHARGE_BPO
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
