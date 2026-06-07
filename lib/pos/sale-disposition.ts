import type { PosSaleDisposition, PosSaleProductMode } from "@prisma/client";
import type { SaleProductMode } from "@/lib/pos/sale-product-mode";

export type SaleDisposition = PosSaleDisposition;

export function parseSaleDisposition(
  raw: string | null | undefined,
): SaleDisposition {
  const v = String(raw ?? "").trim().toUpperCase();
  if (v === "RATION") return "RATION";
  if (v === "PUBLIC_RELATION") return "PUBLIC_RELATION";
  return "NORMAL";
}

/** Legacy sales without saleDisposition are treated as normal. */
export function effectiveSaleDisposition(
  stored: PosSaleDisposition | null | undefined,
): SaleDisposition {
  return stored ?? "NORMAL";
}

export function isRationDisposition(disposition: SaleDisposition): boolean {
  return disposition === "RATION";
}

export function isPublicRelationDisposition(disposition: SaleDisposition): boolean {
  return disposition === "PUBLIC_RELATION";
}

export function isNonPaymentDisposition(disposition: SaleDisposition): boolean {
  return disposition === "RATION" || disposition === "PUBLIC_RELATION";
}

export function isNoTaxDisposition(disposition: SaleDisposition): boolean {
  return disposition === "RATION" || disposition === "PUBLIC_RELATION";
}

export function isNoDeliveryOrderDisposition(disposition: SaleDisposition): boolean {
  return disposition === "RATION" || disposition === "PUBLIC_RELATION";
}

export function assertDispositionForSaleMode(
  _disposition: SaleDisposition,
  _saleProductMode: SaleProductMode | PosSaleProductMode,
): string | null {
  return null;
}
