import type { MobileSessionPayload } from "@pos/shared";
import {
  canValidateConsignmentNoteValidator,
  isPlainSupervisorValidator,
  isSeniorSupervisorValidator,
  pendingConsignmentValidationHint,
  pendingSalesValidationHint,
} from "@pos/shared";

/** Supervisors and senior supervisors validate pending POS sales (scoped by sales point). */
export function canValidateSalesOnMobile(hasPermission: (key: string) => boolean) {
  return hasPermission("ui:validate-documents");
}

/** Line managers and directors validate delivery orders (not sales). */
export function canValidateDeliveryOrdersOnMobile(
  hasPermission: (key: string) => boolean,
) {
  return hasPermission("ui:validate-delivery-orders");
}

/** Line supervisors validate pending vehicle consignment notes (clerks prepare on web). */
export function canValidateConsignmentOnMobile(
  hasPermission: (key: string) => boolean,
  session: MobileSessionPayload | null,
) {
  if (!hasPermission("route:/consignment-notes")) return false;
  if (!session) return false;
  const ctx = {
    role: session.role,
    commercialServiceRoleCode: session.commercialServiceRole?.code,
  };
  if (canValidateConsignmentNoteValidator(ctx)) return true;
  // Web uses stored User.role; line role on mobile may map to senior supervisor
  // while the account row is still SUPERVISOR.
  if (session.role === "SUPERVISOR" || session.role === "ADMIN") return true;
  if (isPlainSupervisorValidator(ctx)) return true;
  if (isSeniorSupervisorValidator(ctx)) return true;
  // Custom line role codes (e.g. "sas") with site-scoped sales validation.
  if (!hasPermission("ui:validate-documents")) return false;
  return Boolean(session.salesPoint?.id);
}

/** Show/fetch the consignment queue for anyone who can approve sales on mobile. */
export function canSeeConsignmentQueueOnMobile(
  hasPermission: (key: string) => boolean,
) {
  return hasPermission("ui:validate-documents");
}

export function canOpenMobileApprovals(
  hasPermission: (key: string) => boolean,
  session?: MobileSessionPayload | null,
) {
  return (
    canValidateSalesOnMobile(hasPermission) ||
    canValidateDeliveryOrdersOnMobile(hasPermission) ||
    canValidateConsignmentOnMobile(hasPermission, session ?? null)
  );
}

export function canAccessMobileApprovalsInbox(
  hasPermission: (key: string) => boolean,
  session?: MobileSessionPayload | null,
) {
  return (
    canOpenMobileApprovals(hasPermission, session) ||
    hasPermission("ui:post-stock-receipt") ||
    hasPermission("ui:dispatch-stock-transfer") ||
    hasPermission("ui:receive-stock-transfer")
  );
}

export function mobileValidationScreenHint(
  session: MobileSessionPayload | null,
  hasPermission: (key: string) => boolean,
): string {
  const canSales = canValidateSalesOnMobile(hasPermission);
  const canDos = canValidateDeliveryOrdersOnMobile(hasPermission);
  const canConsignment = canSeeConsignmentQueueOnMobile(hasPermission);

  if (canDos && !canSales && !canConsignment) {
    return "Managers validate delivery orders only. Open a DO, mark it reviewed, then validate.";
  }
  if (canConsignment && !canSales && !canDos && session) {
    return pendingConsignmentValidationHint({
      role: session.role,
      commercialServiceRoleCode: session.commercialServiceRole?.code,
    });
  }
  if (session && canSales) {
    return pendingSalesValidationHint({
      role: session.role,
      commercialServiceRoleCode: session.commercialServiceRole?.code,
    });
  }
  return "Open each item to review lines and totals before validating.";
}

export function mobilePendingConsignmentEmptyHint(
  session: MobileSessionPayload | null,
): string {
  if (!session) return "No pending vehicle consignment notes.";
  const ctx = {
    role: session.role,
    commercialServiceRoleCode: session.commercialServiceRole?.code,
  };
  if (isSeniorSupervisorValidator(ctx)) {
    return "No pending vehicle consignment notes at Bota.";
  }
  if (!canValidateConsignmentNoteValidator(ctx) && session.role !== "SUPERVISOR") {
    return "Only sales supervisors can validate vehicle consignment notes.";
  }
  const site = session.salesPoint?.name ?? "your sales point";
  return `No pending vehicle consignment notes at ${site}.`;
}

export function mobilePendingSalesEmptyHint(
  session: MobileSessionPayload | null,
): string {
  if (!session) return "No pending invoices.";
  const ctx = {
    role: session.role,
    commercialServiceRoleCode: session.commercialServiceRole?.code,
  };
  if (isSeniorSupervisorValidator(ctx)) {
    return "No pending invoices at Bota.";
  }
  if (isPlainSupervisorValidator(ctx)) {
    return session.salesPoint
      ? `No pending invoices at ${session.salesPoint.name}.`
      : "No pending invoices at your sales point.";
  }
  return "No pending invoices.";
}
