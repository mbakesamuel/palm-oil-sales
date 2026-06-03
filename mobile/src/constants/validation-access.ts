import type { MobileSessionPayload } from "@pos/shared";
import {
  isPlainSupervisorValidator,
  isSeniorSupervisorValidator,
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

export function canOpenMobileApprovals(
  hasPermission: (key: string) => boolean,
) {
  return (
    canValidateSalesOnMobile(hasPermission) ||
    canValidateDeliveryOrdersOnMobile(hasPermission)
  );
}

export function mobileValidationScreenHint(
  session: MobileSessionPayload | null,
  hasPermission: (key: string) => boolean,
): string {
  if (
    canValidateDeliveryOrdersOnMobile(hasPermission) &&
    !canValidateSalesOnMobile(hasPermission)
  ) {
    return "Managers validate delivery orders only. Open a DO, mark it reviewed, then validate.";
  }
  if (session && canValidateSalesOnMobile(hasPermission)) {
    return pendingSalesValidationHint({
      role: session.role,
      commercialServiceRoleCode: session.commercialServiceRole?.code,
    });
  }
  return "Open each item to review lines and totals before validating.";
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
