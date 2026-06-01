import type { StockDocStatus, StockMovementKind } from "@prisma/client";

export const STOCK_DOC_STATUS_LABELS: Record<StockDocStatus, string> = {
  DRAFT: "Draft",
  POSTED: "Posted",
  DISPATCHED: "Dispatched",
  RECEIVED: "Received",
  CANCELLED: "Cancelled",
};

export const STOCK_MOVEMENT_KIND_LABELS: Record<StockMovementKind, string> = {
  RECEIPT: "Receipt",
  TRANSFER_OUT: "Transfer out",
  TRANSFER_IN: "Transfer in",
  SALE: "Sale",
  SALE_REVERSAL: "Sale reversal",
  ADJUSTMENT: "Adjustment",
};

export function stockMovementSign(kind: StockMovementKind): "+" | "-" | "±" {
  switch (kind) {
    case "RECEIPT":
    case "TRANSFER_IN":
    case "SALE_REVERSAL":
      return "+";
    case "TRANSFER_OUT":
    case "SALE":
      return "-";
    case "ADJUSTMENT":
      return "±";
  }
}

export type MovementQtyColumnRow = {
  id: string;
  kind: StockMovementKind;
  qty: string;
  uom: string;
  signedQty?: string;
};

/** Split movement quantity into + and − ledger columns for display. */
export function movementQtyColumns(
  row: MovementQtyColumnRow,
  formatQty: (qty: string) => string,
): { plus: string | null; minus: string | null } {
  const label = (q: string) => {
    const formatted = formatQty(q);
    return row.uom ? `${formatted} ${row.uom}` : formatted;
  };

  if (row.id.startsWith("RECLASS:")) {
    const both = label(row.qty);
    return { plus: both, minus: both };
  }

  if (row.signedQty) {
    const n = Number(row.signedQty);
    if (n > 0) return { plus: label(row.qty), minus: null };
    if (n < 0) return { plus: null, minus: label(row.qty) };
    return { plus: null, minus: null };
  }

  const sign = stockMovementSign(row.kind);
  if (sign === "+") return { plus: label(row.qty), minus: null };
  if (sign === "-") return { plus: null, minus: label(row.qty) };
  return { plus: null, minus: null };
}
