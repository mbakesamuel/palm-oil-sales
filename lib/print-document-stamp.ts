import { ValidationStatus } from "@/lib/domain";

/** Stock document statuses used on printable vouchers. */
export type StockDocPrintStatus =
  | "DRAFT"
  | "POSTED"
  | "DISPATCHED"
  | "RECEIVED"
  | "CANCELLED";

/** Watermark label for sales invoices, DOs, and consignment notes. */
export function printStampLabelForValidationStatus(
  status: ValidationStatus | string,
): string | null {
  if (status === ValidationStatus.VALIDATED || status === "VALIDATED") return null;
  if (status === ValidationStatus.REJECTED || status === "REJECTED") return "REJECTED";
  return "DRAFT";
}

/** Watermark label for stock receipt / transfer vouchers (non-final states). */
export function printStampLabelForStockDocStatus(
  status: StockDocPrintStatus | string,
): string | null {
  if (status === "POSTED" || status === "RECEIVED") return null;
  if (status === "CANCELLED") return "CANCELLED";
  if (status === "DRAFT") return "DRAFT";
  if (status === "DISPATCHED") return "DISPATCHED";
  return null;
}
