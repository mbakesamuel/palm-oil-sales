/**
 * Permission key list + types only — safe to import from Client Components.
 * (Do not import `lib/access-control.ts` from the browser: it loads Prisma.)
 */

export const PERMISSION_KEYS = [
  "route:/dashboard",
  "route:/setup",
  "route:/setup/permissions",
  "route:/users",
  "route:/customers",
  "route:/financial-years",
  "route:/sales-points",
  "route:/tax-regimes",
  "route:/product-categories",
  "route:/products",
  "route:/delivery-orders",
  "route:/pos",
  "route:/reports/sales",
  "route:/reports/delivery-orders",
  "route:/reports/delivery-order-monitor",
  "route:/reports/customer-delivery-monitor",
  "route:/reports/do-commitment-crosstab",
  "ui:validate-documents",
  "ui:manage-access-control",
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];
