import type { AuthSession } from "@/lib/auth-session";
import { UserRole } from "@/lib/domain";
import { userRoleFromLineRoleCode } from "@/lib/line-role-user-role";

export {
  roleRequiresCommercialServiceAssignment,
  roleSeesAllCommercialServices,
} from "@/lib/service-scope";

/** Workflow role: line role code wins over stale `User.role` on the account row. */
export function effectiveSessionRole(
  session: Pick<AuthSession, "role" | "commercialServiceRole">,
): UserRole {
  if (session.commercialServiceRole?.code) {
    return userRoleFromLineRoleCode(session.commercialServiceRole.code);
  }
  return session.role;
}

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
 * Legacy UserRole heuristic for sales-invoice validation. Runtime enforcement
 * uses permission `ui:validate-documents` (senior supervisors get it via Role
 * access; managers do not). Line supervisors validate clerk invoices.
 */
export function canValidateDocuments(role: UserRole): boolean {
  return (
    role === UserRole.ADMIN ||
    role === UserRole.DIRECTOR ||
    role === UserRole.SUPERVISOR
  );
}

/**
 * Legacy draft-delivery-order role heuristic. Prefer `canDraftDeliveryOrders` in
 * `lib/access-control.ts` (permission `ui:draft-delivery-orders` from Role access).
 */
export function canCreateOrEditDeliveryOrderDraft(
  role: UserRole,
  commercialServiceRoleCode?: string | null,
): boolean {
  if (role === UserRole.SENIOR_SUPERVISOR || role === UserRole.ADMIN) return true;
  const c = (commercialServiceRoleCode ?? "").toLowerCase();
  return c.includes("senior") && c.includes("supervisor");
}

/**
 * Legacy UserRole heuristic for DO validation. Runtime enforcement uses
 * `ui:validate-delivery-orders` (managers/directors; not senior supervisors).
 */
export function canValidateDeliveryOrder(role: UserRole): boolean {
  return (
    role === UserRole.DIRECTOR ||
    role === UserRole.ADMIN ||
    role === UserRole.MANAGER
  );
}

/**
 * Open the POS pending-invoice picker (supervisors validate clerk drafts).
 * Prefer `ui:validate-documents` from Role access; falls back to line role code.
 */
export function canPickPendingPosSales(params: {
  validateDocuments: boolean;
  role: UserRole;
  commercialServiceRoleCode?: string | null;
}): boolean {
  if (params.validateDocuments) return true;
  if (canValidateDocuments(params.role)) return true;
  const c = (params.commercialServiceRoleCode ?? "").toLowerCase();
  if (c.includes("senior") && c.includes("supervisor")) return true;
  if (
    c.includes("supervisor") &&
    !c.includes("senior") &&
    !c.includes("manager")
  ) {
    return true;
  }
  return false;
}

/** Draft vehicle consignment notes (1:1 with Sale): clerks prepare; supervisors validate. */
export function canCreateOrEditConsignmentNoteDraft(role: UserRole): boolean {
  return role === UserRole.CLERK || role === UserRole.ADMIN;
}

/** Validate a pending vehicle consignment note after a clerk has prepared it. */
export function canValidateConsignmentNote(role: UserRole): boolean {
  return role === UserRole.SUPERVISOR || role === UserRole.ADMIN;
}
