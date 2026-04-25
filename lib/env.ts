export const DEFAULTS = {
  currency: process.env.DEFAULT_CURRENCY ?? "XAF",
  vatRate: Number.parseFloat(process.env.DEFAULT_VAT_RATE ?? "0.1925"),
  invoicePrefix: process.env.DEFAULT_INVOICE_PREFIX ?? "PO",
} as const;

export function getVatRateDecimal(): string {
  // Prisma Decimal columns expect string inputs for exactness.
  return DEFAULTS.vatRate.toString();
}
