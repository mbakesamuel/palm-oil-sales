import { CustomerType } from "@/lib/domain";

export type PricingScheduleRow = {
  id: string;
  productId: number;
  productName: string;
  productCatId: number;
  customerType: string | null;
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

export function labelCustomerType(ct: string | null): string {
  if (!ct) return "Direct price";
  switch (ct) {
    case CustomerType.INDUSTRY:
      return "Industry";
    case CustomerType.WHOLE_SALE:
      return "Wholesale";
    case CustomerType.RETAIL:
      return "Retail";
    case CustomerType.WORKER:
      return "Worker";
    default:
      return ct;
  }
}

/** Stable ordering for customer-type rows within a product group. */
const CUSTOMER_TYPE_RANK: Record<string, number> = {
  [CustomerType.INDUSTRY]: 0,
  [CustomerType.WHOLE_SALE]: 1,
  [CustomerType.RETAIL]: 2,
  [CustomerType.WORKER]: 3,
};

function customerTypeRank(ct: string | null): number {
  if (!ct) return -1;
  return CUSTOMER_TYPE_RANK[ct] ?? 99;
}

/** Reduces a flat list of price-schedule rows to the latest row per (product, customerType). */
export function pickLatestPricingRows<T extends PricingScheduleRow>(rows: T[]): T[] {
  const bestByKey = new Map<string, T>();
  for (const r of rows) {
    const k = `${r.productId}:${r.customerType ?? ""}`;
    const prev = bestByKey.get(k);
    if (!prev) {
      bestByKey.set(k, r);
      continue;
    }
    if (r.effectiveFromIso > prev.effectiveFromIso) bestByKey.set(k, r);
  }
  return [...bestByKey.values()];
}

export function buildPricingGroups(rows: PricingScheduleRow[]): PricingProductGroup[] {
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
      (a, b) => customerTypeRank(a.customerType) - customerTypeRank(b.customerType),
    );
  }
  groups.sort((a, b) =>
    a.productName.localeCompare(b.productName, undefined, { sensitivity: "base" }),
  );
  return groups;
}
