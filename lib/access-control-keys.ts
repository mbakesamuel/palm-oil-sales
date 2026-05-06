/**
 * Permission key list + types only — safe to import from Client Components.
 * (Do not import `lib/access-control.ts` from the browser: it loads Prisma.)
 */

export const PERMISSION_KEYS = [
  "route:/dashboard",
  "route:/setup",
  "route:/setup/permissions",
  "route:/setup/product-pricing",
  "route:/setup/sales-budget",
  "route:/users",
  "route:/customers",
  "route:/financial-years",
  "route:/sales-points",
  "route:/storage-locations",
  "route:/tax-regimes",
  "route:/tax-types",
  "route:/product-categories",
  "route:/products",
  "route:/delivery-orders",
  "route:/consignment-notes",
  "route:/pos",
  "route:/stock/receive",
  "route:/reports",
  "route:/reports/sales",
  "route:/reports/daily-sales-summary",
  "route:/reports/delivery-orders",
  "route:/reports/delivery-order-monitor",
  "route:/reports/customer-delivery-monitor",
  "route:/reports/do-commitment-crosstab",
  "route:/reports/stock-on-hand",
  "route:/reports/stock-vs-commitments",
  "route:/reports/sales-budget-monthly-crosstab",
  "ui:validate-documents",
  "ui:manage-access-control",
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];
