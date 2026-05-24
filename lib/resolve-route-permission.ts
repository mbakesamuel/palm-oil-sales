import { PERMISSION_KEYS, type PermissionKey } from "@/lib/access-control-keys";

/**
 * Maps the current URL path to a `route:*` permission key (longest prefix wins).
 * Returns null when no configured route key applies (caller may allow).
 */
export function resolveRoutePermissionKey(pathname: string): PermissionKey | null {
  const normalized = (pathname.replace(/\/+$/, "") || "/") as string;

  if (normalized.startsWith("/sales/")) {
    return "route:/pos";
  }
  if (
    normalized === "/setup/product-variants" ||
    normalized.startsWith("/setup/product-variants/") ||
    normalized === "/setup/bpo-variants" ||
    normalized.startsWith("/setup/bpo-variants/")
  ) {
    return "route:/setup/bpo-variants";
  }
  if (
    normalized === "/reports/bpo-pricing" ||
    normalized.startsWith("/reports/bpo-pricing/")
  ) {
    return "route:/reports/pricing";
  }
  if (normalized.startsWith("/delivery-orders/") && normalized !== "/delivery-orders") {
    return "route:/delivery-orders";
  }

  const routeKeys = PERMISSION_KEYS.filter((k): k is PermissionKey =>
    (k as string).startsWith("route:"),
  );
  const sorted = [...routeKeys].sort((a, b) => {
    const pa = a.slice("route:".length);
    const pb = b.slice("route:".length);
    return pb.length - pa.length;
  });

  for (const key of sorted) {
    const path = key.slice("route:".length);
    if (normalized === path || normalized.startsWith(`${path}/`)) {
      return key;
    }
  }
  return null;
}
