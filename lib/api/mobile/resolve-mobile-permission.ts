import type { PermissionKey } from "@/lib/access-control-keys";

/**
 * Maps mobile API paths to the same permission keys used by the web app.
 * Longest-prefix match wins.
 */
const MOBILE_ROUTE_PERMISSIONS: Array<{ prefix: string; key: PermissionKey }> = [
  { prefix: "/api/mobile/v1/dashboard/executive", key: "route:/dashboard/executive" },
  { prefix: "/api/mobile/v1/dashboard/lines", key: "route:/dashboard" },
  { prefix: "/api/mobile/v1/reports/stock-vs-commitments", key: "route:/reports/stock-vs-commitments" },
  { prefix: "/api/mobile/v1/reports/stock-inquiry", key: "route:/reports/stock-inquiry" },
  { prefix: "/api/mobile/v1/reports/daily-sales-summary", key: "route:/reports/daily-sales-summary" },
  { prefix: "/api/mobile/v1/reports/commitments", key: "route:/reports/do-commitment-crosstab" },
  {
    prefix: "/api/mobile/v1/validation/delivery-orders/validate-reviewed",
    key: "route:/delivery-orders/validation-queue",
  },
  {
    prefix: "/api/mobile/v1/validation/delivery-orders/mark-reviewed",
    key: "route:/delivery-orders/validation-queue",
  },
  { prefix: "/api/mobile/v1/validation/delivery-orders", key: "route:/delivery-orders/validation-queue" },
  { prefix: "/api/mobile/v1/validation/sales", key: "route:/pos" },
  { prefix: "/api/mobile/v1/me", key: "route:/dashboard" },
];

export function resolveMobilePermissionKey(pathname: string): PermissionKey | null {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  let best: { prefix: string; key: PermissionKey } | null = null;
  for (const entry of MOBILE_ROUTE_PERMISSIONS) {
    if (
      normalized === entry.prefix ||
      normalized.startsWith(`${entry.prefix}/`)
    ) {
      if (!best || entry.prefix.length > best.prefix.length) {
        best = entry;
      }
    }
  }
  return best?.key ?? null;
}

/** POST .../validation/sales/:id/validate uses ui permission, not route. */
export function resolveMobileValidateSalePermission(): PermissionKey {
  return "ui:validate-documents";
}
