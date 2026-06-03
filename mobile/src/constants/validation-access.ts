/** Supervisors and senior supervisors validate pending POS sales. */
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
