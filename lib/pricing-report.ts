import type { CustomerTypeOption } from "@/lib/customer-types/types";
import { customerTypeSortRank } from "@/lib/customer-types/types";

export type PricingScheduleRow = {
  id: string;
  productId: number;
  productName: string;
  productCatId: number;
  customerTypeId: string | null;
  customerTypeName: string | null;
  effectiveFromIso: string;
  unitPriceExTax: string;
};

export type PricingProductGroup = {
  productId: number;
  productName: string;
  /** Latest effective date across all rows of this product. */
  effectiveFromIso: string;
  rows: PricingScheduleRow[];
};

export function labelCustomerTypeRow(row: {
  customerTypeId: string | null;
  customerTypeName?: string | null;
}): string {
  if (!row.customerTypeId) return "Direct price";
  return row.customerTypeName?.trim() || row.customerTypeId;
}

/** @deprecated Use labelCustomerTypeRow — kept for string code/id fallbacks. */
export function labelCustomerType(
  ct: string | null,
  options?: CustomerTypeOption[],
): string {
  if (!ct) return "Direct price";
  const byId = options?.find((o) => o.id === ct);
  if (byId) return byId.name;
  const byCode = options?.find((o) => o.code === ct);
  if (byCode) return byCode.name;
  switch (ct) {
    case "INDUSTRY":
      return "Industry";
    case "WHOLE_SALE":
      return "Wholesale";
    case "RETAIL":
      return "Retail";
    case "WORKER":
      return "Worker";
    default:
      return ct;
  }
}

/** Reduces a flat list of price-schedule rows to the latest row per (product, customerType). */
export function pickLatestPricingRows<T extends PricingScheduleRow>(rows: T[]): T[] {
  const bestByKey = new Map<string, T>();
  for (const r of rows) {
    const k = `${r.productId}:${r.customerTypeId ?? ""}`;
    const prev = bestByKey.get(k);
    if (!prev) {
      bestByKey.set(k, r);
      continue;
    }
    if (r.effectiveFromIso > prev.effectiveFromIso) bestByKey.set(k, r);
  }
  return [...bestByKey.values()];
}

export function buildPricingGroups(
  rows: PricingScheduleRow[],
  customerTypeOptions: CustomerTypeOption[] = [],
): PricingProductGroup[] {
  const byProduct = new Map<number, PricingProductGroup>();
  for (const r of rows) {
    const existing = byProduct.get(r.productId);
    if (!existing) {
      byProduct.set(r.productId, {
        productId: r.productId,
        productName: r.productName,
        effectiveFromIso: r.effectiveFromIso,
        rows: [r],
      });
      continue;
    }
    existing.rows.push(r);
    if (r.effectiveFromIso > existing.effectiveFromIso) {
      existing.effectiveFromIso = r.effectiveFromIso;
    }
  }
  const groups = [...byProduct.values()];
  for (const g of groups) {
    g.rows.sort(
      (a, b) =>
        customerTypeSortRank(a.customerTypeId, customerTypeOptions) -
        customerTypeSortRank(b.customerTypeId, customerTypeOptions),
    );
  }
  groups.sort((a, b) =>
    a.productName.localeCompare(b.productName, undefined, { sensitivity: "base" }),
  );
  return groups;
}
