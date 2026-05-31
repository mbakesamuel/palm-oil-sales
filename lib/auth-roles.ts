import { UserRole } from "@/lib/domain";

export {
  roleRequiresCommercialServiceAssignment,
  roleSeesAllCommercialServices,
} from "@/lib/service-scope";

/**
 * Legacy UserRole fallback when a line role has no `requiresFixedPostingSite` flag loaded.
 * Prefer `sessionRequiresFixedPostingSite` / `actorRequiresFixedPostingSite` for enforcement.
 */
export function roleRequiresSalesPoint(role: UserRole): boolean {
  return role === UserRole.CLERK || role === UserRole.SUPERVISOR;
}

/** Sales-point staff see delivery orders only after manager validation (reports, load, print, POS lookup). */
export function roleSeesOnlyValidatedDeliveryOrders(role: UserRole): boolean {
  return roleRequiresSalesPoint(role);
}

/**
 * Roles allowed to validate **sales invoices** (legacy helper; POS uses
 * permission `ui:validate-documents`). Excludes senior supervisors — they
 * draft DOs; line supervisors validate clerk invoices.
 */
export function canValidateDocuments(role: UserRole): boolean {
  return (
    role === UserRole.ADMIN ||
    role === UserRole.DIRECTOR ||
    role === UserRole.SUPERVISOR
  );
}

/** Draft delivery orders: created / edited / deleted while still pending. */
export function canCreateOrEditDeliveryOrderDraft(role: UserRole): boolean {
  return role === UserRole.SENIOR_SUPERVISOR || role === UserRole.ADMIN;
}

/** Validate a pending delivery order after a senior supervisor has prepared it. */
export function canValidateDeliveryOrder(role: UserRole): boolean {
  return (
    role === UserRole.DIRECTOR ||
    role === UserRole.ADMIN ||
    role === UserRole.MANAGER
  );
}

/** Open the POS pending-invoice picker (supervisors validate; senior supervisors review). */
export function canPickPendingPosSales(params: {
  validateDocuments: boolean;
  role: UserRole;
  commercialServiceRoleCode?: string | null;
}): boolean {
  if (params.validateDocuments) return true;
  if (params.role === UserRole.SENIOR_SUPERVISOR) return true;
  const c = (params.commercialServiceRoleCode ?? "").toLowerCase();
  return c.includes("senior") && c.includes("supervisor");
}

/** Draft vehicle consignment notes (1:1 with Sale): clerks prepare; supervisors validate. */
export function canCreateOrEditConsignmentNoteDraft(role: UserRole): boolean {
  return role === UserRole.CLERK || role === UserRole.ADMIN;
}

/** Validate a pending vehicle consignment note after a clerk has prepared it. */
export function canValidateConsignmentNote(role: UserRole): boolean {
  return role === UserRole.SUPERVISOR || role === UserRole.ADMIN;
}
