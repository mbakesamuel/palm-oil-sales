import type { PermissionKey } from "@/lib/access-control-keys";

/**
 * Logical modules per commercial line. Stored on `CommercialService.enabledModules`.
 * Routes are gated by module + role permission.
 */
export const COMMERCIAL_MODULE_KEYS = [
  "dashboard",
  "setup",
  "customers",
  "financial",
  "catalog",
  "sales_points",
  "factories",
  "palm_operations",
  "palm_reports",
  "bpo",
  "rubber_operations",
  "rubber_reports",
  "stock",
] as const;

export type CommercialModuleKey = (typeof COMMERCIAL_MODULE_KEYS)[number];

export const COMMERCIAL_MODULE_LABELS: Record<CommercialModuleKey, string> = {
  dashboard: "Dashboard",
  setup: "Settings & setup",
  customers: "Customers",
  financial: "Financial years",
  catalog: "Products & categories",
  sales_points: "Sales points",
  factories: "Factories",
  palm_operations: "Palm sales & delivery orders",
  palm_reports: "Palm reports",
  bpo: "Bottled Palm Oil sales",
  rubber_operations: "Rubber operations",
  rubber_reports: "Rubber reports",
  stock: "Stock management",
};

export function defaultModulesForSiteKind(
  siteKind: "SALES_POINT" | "FACTORY",
): CommercialModuleKey[] {
  return siteKind === "FACTORY" ? [...RUBBER_MODULE_KEYS] : [...PALM_OIL_MODULE_KEYS];
}

/** Default modules for palm-oil / collection-point lines. */
export const PALM_OIL_MODULE_KEYS: CommercialModuleKey[] = [
  "dashboard",
  "setup",
  "customers",
  "financial",
  "catalog",
  "sales_points",
  "palm_operations",
  "palm_reports",
  "bpo",
  "stock",
];

/** Default modules for rubber / factory lines. */
export const RUBBER_MODULE_KEYS: CommercialModuleKey[] = [
  "dashboard",
  "setup",
  "customers",
  "financial",
  "catalog",
  "factories",
  "rubber_operations",
  "rubber_reports",
  "stock",
];

const MODULE_ROUTE_KEYS: Record<CommercialModuleKey, readonly PermissionKey[]> = {
  dashboard: ["route:/dashboard", "route:/dashboard/executive"],
  setup: [
    "route:/setup",
    "route:/setup/commercial-services",
    "route:/setup/permissions",
    "route:/setup/product-pricing",
    "route:/setup/bpo-variants",
    "route:/setup/product-variants",
    "route:/setup/sales-budget",
    "route:/users",
    "route:/tax-regimes",
    "route:/tax-types",
    "route:/product-categories",
    "route:/products",
  ],
  customers: ["route:/customers"],
  financial: ["route:/financial-years"],
  catalog: ["route:/products", "route:/product-categories"],
  sales_points: ["route:/sales-points"],
  factories: ["route:/factories"],
  palm_operations: [
    "route:/delivery-orders",
    "route:/delivery-orders/list",
    "route:/delivery-orders/validation-queue",
    "route:/consignment-notes",
    "route:/pos",
    "route:/pos/list",
  ],
  palm_reports: [
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
    "route:/api/mobile/v1",
    "route:/reports/sales-budget-monthly-crosstab",
    "route:/reports/sales-budget-weekly-crosstab",
    "route:/reports/pricing",
  ],
  bpo: [
    "route:/bpo-sales",
    "route:/reports/bpo-pricing",
    "route:/reports/bpo",
    "route:/reports/bpo-sales-crosstab",
  ],
  rubber_operations: ["route:/rubber"],
  rubber_reports: ["route:/reports", "route:/reports/sales"],
  stock: ["route:/stock"],
};

const ROUTE_TO_MODULE = new Map<string, CommercialModuleKey>();
for (const [mod, keys] of Object.entries(MODULE_ROUTE_KEYS) as [
  CommercialModuleKey,
  readonly PermissionKey[],
][]) {
  for (const k of keys) {
    ROUTE_TO_MODULE.set(k, mod);
  }
}

export function permissionKeysForModules(
  modules: readonly CommercialModuleKey[],
): Set<PermissionKey> {
  const out = new Set<PermissionKey>();
  for (const mod of modules) {
    for (const k of MODULE_ROUTE_KEYS[mod] ?? []) {
      out.add(k);
    }
  }
  return out;
}

export function moduleKeyForRoutePermissionKey(key: PermissionKey): CommercialModuleKey | null {
  return ROUTE_TO_MODULE.get(key) ?? null;
}

export function moduleKeyForPathname(pathname: string): CommercialModuleKey | null {
  const path = pathname.trim();
  if (!path) return null;
  const candidates = [`route:${path}`, ...findRoutePrefixKeys(path)];
  for (const c of candidates) {
    const mod = ROUTE_TO_MODULE.get(c);
    if (mod) return mod;
  }
  return null;
}

function findRoutePrefixKeys(pathname: string): string[] {
  const parts = pathname.split("/").filter(Boolean);
  const keys: string[] = [];
  let acc = "";
  for (const p of parts) {
    acc += `/${p}`;
    keys.push(`route:${acc}`);
  }
  return keys;
}

export function parseEnabledModulesJson(raw: unknown): CommercialModuleKey[] {
  if (!Array.isArray(raw)) return [...PALM_OIL_MODULE_KEYS];
  const valid = new Set<string>(COMMERCIAL_MODULE_KEYS);
  return raw
    .map((x) => String(x).trim())
    .filter((x): x is CommercialModuleKey => valid.has(x));
}
