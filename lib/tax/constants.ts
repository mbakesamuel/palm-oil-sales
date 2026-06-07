/** Canonical code for value-added tax in TaxType and snapshots. */
export const VAT_TAX_CODE = "VAT" as const;

/** Canonical code for sales tax in TaxType and snapshots. */
export const SALES_TAX_CODE = "SAT" as const;

/** VAT and sales tax rates are edited on Setup → Tax rates, not Tax types. */
export function isOperationalTaxCode(code: string): boolean {
  return code === VAT_TAX_CODE || code === SALES_TAX_CODE;
}
