import type { ProductForm } from "@prisma/client";
import { StockMovementType } from "@prisma/client";

export const HUB_SALES_POINT_NAME = "Bota";

export function hubBlocksVariantReceipt(salesPointId: number, hubId: number | null): boolean {
  return hubId != null && salesPointId === hubId;
}

export function requiresStorageLocation(form: ProductForm): boolean {
  return form === "LOOSE";
}

export function movementTypeForLegacyBpo(type: string): StockMovementType {
  switch (type) {
    case "CONSIGNMENT_TRANSFER":
      return StockMovementType.TRANSFER;
    case "GIFT":
      return StockMovementType.ISSUE_GIFT;
    case "OTHER_OUT":
      return StockMovementType.ISSUE_OTHER;
    default:
      return StockMovementType.ADJUSTMENT;
  }
}
