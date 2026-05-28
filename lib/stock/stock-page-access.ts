import type { PermissionKey } from "@/lib/access-control-keys";

export type StockPermissionSlice = Partial<Record<PermissionKey, boolean>>;

export function canAccessStockPage(permissions: StockPermissionSlice): boolean {
  return Boolean(permissions["route:/stock"]);
}
