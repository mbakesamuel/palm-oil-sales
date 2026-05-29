/**
 * Permission key list + types only — safe to import from Client Components.
 * (Do not import `lib/access-control.ts` from the browser: it loads Prisma.)
 */

export const PERMISSION_KEYS = [
  "route:/dashboard",
  "route:/dashboard/executive",
  "route:/setup",
  "route:/setup/commercial-services",
  "route:/setup/permissions",
  "route:/setup/product-pricing",
  "route:/setup/bpo-variants",
  "route:/setup/product-variants",
  "route:/setup/sales-budget",
  "route:/users",
  "route:/customers",
  "route:/financial-years",
  "route:/sales-points",
  "route:/factories",
  "route:/rubber",
  "route:/tax-regimes",
  "route:/tax-types",
  "route:/product-categories",
  "route:/products",
  "route:/delivery-orders",
  "route:/delivery-orders/list",
  "route:/delivery-orders/validation-queue",
  "route:/consignment-notes",
  "route:/pos",
  "route:/bpo-sales",
  "route:/reports",
  "route:/reports/sales",
  "route:/reports/daily-sales-summary",
  "route:/reports/daily-sales-summary/print",
  "route:/reports/delivery-orders",
  "route:/reports/delivery-order-monitor",
  "route:/reports/customer-delivery-monitor",
  "route:/reports/do-commitment-crosstab",
  "route:/reports/do-commitment-crosstab/print",
  "route:/reports/stock-on-hand",
  "route:/reports/stock-on-hand/print",
  "route:/reports/sales-budget-monthly-crosstab",
  "route:/reports/sales-budget-weekly-crosstab",
  "route:/reports/pricing",
  "route:/reports/bpo-pricing",
  "route:/reports/bpo",
  "route:/reports/bpo-sales-crosstab",
  "route:/stock",
  "ui:validate-documents",
  "ui:validate-delivery-orders",
  "ui:manage-access-control",
  "ui:post-stock-receipt",
  "ui:dispatch-stock-transfer",
  "ui:receive-stock-transfer",
  "ui:post-stock-adjustment",
  "ui:reclassify-stock-condition",
  "ui:cancel-stock-document",
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

const PERMISSION_LABELS: Partial<Record<PermissionKey, string>> = {
  "ui:validate-documents": "Validate sales invoices and similar documents",
  "ui:validate-delivery-orders": "Validate delivery orders",
  "ui:manage-access-control": "Manage access control (Setup → Permissions)",
  "ui:post-stock-receipt": "Post stock receipts (external / factory deliveries)",
  "ui:dispatch-stock-transfer": "Dispatch stock transfers from a sales point",
  "ui:receive-stock-transfer": "Receive stock transfers at a sales point",
  "ui:post-stock-adjustment": "Post stock adjustments (manual gain / loss)",
  "ui:reclassify-stock-condition":
    "Reclassify stock between sellable and unsellable (manager only)",
  "ui:cancel-stock-document": "Cancel posted stock documents (reverse movements)",
};

/** Human-readable label for permission keys shown in Setup → Permissions. */
export function permissionLabelForKey(key: PermissionKey): string {
  return PERMISSION_LABELS[key] ?? key;
}
