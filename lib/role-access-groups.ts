import type { PermissionKey } from "@/lib/access-control-keys";

export type RoleAccessGroup = {
  id: string;
  label: string;
  description: string;
  keys: readonly PermissionKey[];
};

export const ROLE_ACCESS_GROUPS: readonly RoleAccessGroup[] = [
  {
    id: "mobile",
    label: "Mobile monitoring app",
    description: "Sign in to the Android monitoring app and call /api/mobile/v1.",
    keys: ["route:/api/mobile/v1"],
  },
  {
    id: "operations",
    label: "Operations",
    description: "POS, delivery orders, stock movement, consignment notes.",
    keys: [
      "route:/delivery-orders",
      "route:/delivery-orders/list",
      "route:/delivery-orders/validation-queue",
      "ui:draft-delivery-orders",
      "route:/consignment-notes",
      "route:/pos",
      "route:/pos/list",
      "route:/stock",
      "route:/rubber",
      "route:/factories",
      "ui:post-stock-receipt",
      "ui:dispatch-stock-transfer",
      "ui:receive-stock-transfer",
      "ui:post-stock-adjustment",
      "ui:reclassify-stock-condition",
      "ui:cancel-stock-document",
    ],
  },
  {
    id: "validate-sales",
    label: "Validate POS sales",
    description:
      "Validate pending sales invoices at POS. Typical for line supervisors and senior supervisors (not managers).",
    keys: ["ui:validate-documents"],
  },
  {
    id: "validate-delivery-orders",
    label: "Validate delivery orders",
    description:
      "Validate pending delivery orders and use the validation queue. Typical for managers and directors (not senior supervisors).",
    keys: [
      "route:/delivery-orders/validation-queue",
      "ui:validate-delivery-orders",
    ],
  },
  {
    id: "reports",
    label: "Reports",
    description: "Report routes including palm and stock reports.",
    keys: [
      "route:/reports",
      "route:/reports/sales",
      "route:/reports/daily-sales-summary",
      "route:/reports/daily-sales-summary/print",
      "route:/reports/sales-summary-by-customer",
      "route:/reports/sales-summary-by-customer/print",
      "route:/reports/delivery-orders",
      "route:/reports/delivery-order-monitor",
      "route:/reports/customer-delivery-monitor",
      "route:/reports/do-commitment-crosstab",
      "route:/reports/do-commitment-crosstab/print",
      "route:/reports/stock-on-hand",
      "route:/reports/stock-on-hand/print",
      "route:/reports/stock-inquiry",
      "route:/reports/stock-inquiry/print",
      "route:/reports/stock-vs-commitments",
      "route:/reports/stock-vs-commitments/print",
      "route:/reports/sales-budget-monthly-crosstab",
      "route:/reports/sales-budget-weekly-crosstab",
      "route:/reports/pricing",
    ],
  },
  {
    id: "leadership",
    label: "Leadership",
    description: "Executive dashboard and sales budget setup.",
    keys: [
      "route:/dashboard/executive",
      "route:/setup/sales-budget",
    ],
  },
  {
    id: "setup",
    label: "Setup & administration",
    description: "Master data, users, and access control screens.",
    keys: [
      "route:/setup",
      "route:/setup/commercial-services",
      "route:/setup/permissions",
      "route:/setup/product-pricing",
      "route:/setup/product-variants",
      "route:/setup/tax-rates",
      "route:/users",
      "route:/customers",
      "route:/financial-years",
      "route:/sales-points",
      "route:/factories",
      "route:/tax-regimes",
      "route:/tax-types",
      "route:/product-categories",
      "route:/products",
      "ui:manage-access-control",
    ],
  },
] as const;

export function groupKeysForModules(
  group: RoleAccessGroup,
  allowedRouteKeys: ReadonlySet<PermissionKey>,
): PermissionKey[] {
  return group.keys.filter(
    (k) => !k.startsWith("route:") || allowedRouteKeys.has(k),
  );
}

export function groupStateForPermissions(
  map: Record<string, boolean> | null,
  groupId: string,
  routeFilter: ReadonlySet<PermissionKey> | null,
): "on" | "off" | "mixed" | "loading" {
  if (!map) return "loading";
  const group = ROLE_ACCESS_GROUPS.find((g) => g.id === groupId);
  if (!group) return "off";

  const keys =
    routeFilter != null
      ? groupKeysForModules(group, routeFilter)
      : [...group.keys];
  if (keys.length === 0) return "off";

  const values = keys.map((k) => Boolean(map[k]));
  if (values.every(Boolean)) return "on";
  if (values.every((v) => !v)) return "off";
  return "mixed";
}
