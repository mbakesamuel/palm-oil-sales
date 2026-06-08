import { PosSaleProductMode, type Prisma } from "@prisma/client";

export type SaleLineQtyInput = {
  qtyKg: Prisma.Decimal;
  qtyUnits: Prisma.Decimal | null;
};

export function saleLineUsesUnits(
  saleProductMode: PosSaleProductMode | null,
  line: SaleLineQtyInput,
): boolean {
  if (saleProductMode === PosSaleProductMode.BOTTLE) return true;
  return line.qtyUnits != null && line.qtyUnits.gt(0);
}

export type SaleQtyTotals = {
  kg: number;
  units: number;
};

export function sumSaleLineQuantities(
  saleProductMode: PosSaleProductMode | null,
  lines: SaleLineQtyInput[],
): SaleQtyTotals {
  let kg = 0;
  let units = 0;
  for (const line of lines) {
    if (saleLineUsesUnits(saleProductMode, line)) {
      units += Number(line.qtyUnits ?? line.qtyKg ?? 0);
    } else {
      kg += Number(line.qtyKg ?? 0);
    }
  }
  return { kg, units };
}

export function formatSaleQtyTotals(totals: SaleQtyTotals): string {
  const parts: string[] = [];
  if (totals.kg > 0) {
    parts.push(`${totals.kg.toLocaleString(undefined)} kg`);
  }
  if (totals.units > 0) {
    parts.push(`${totals.units.toLocaleString(undefined)} units`);
  }
  return parts.join(" · ");
}

export function formatSaleProductSummary(
  lines: Array<{ product: { productName: string } }>,
): string {
  const names = [...new Set(lines.map((l) => l.product.productName.trim()).filter(Boolean))];
  return names.join("; ");
}
