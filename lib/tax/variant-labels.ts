import { TaxRateVariant } from "@prisma/client";

export const TAX_RATE_VARIANT_LABELS: Record<TaxRateVariant, string> = {
  DEFAULT: "Default (VAT)",
  SIMPLIFIED: "Simplified regime",
  REAL: "Real regime",
  NO_TAXPAYER_ID: "No tax regime / no taxpayer card",
};

export function salesTaxVariantHint(variant: TaxRateVariant): string {
  switch (variant) {
    case TaxRateVariant.REAL:
      return "Customers assigned a Real tax regime.";
    case TaxRateVariant.SIMPLIFIED:
      return "Customers assigned a Simplified tax regime.";
    case TaxRateVariant.NO_TAXPAYER_ID:
      return "Local customers with no tax regime (no taxpayer card).";
    default:
      return "";
  }
}
