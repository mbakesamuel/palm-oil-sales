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
