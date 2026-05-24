import type { ProductForm } from "@prisma/client";
import { hubBlocksVariantReceipt, requiresStorageLocation } from "@/lib/stock-policy-shared";

export type StockOperationMode = "receive" | "transfer" | "issue";

export type StockIssueDestination =
  | "CUSTOMER_SALE"
  | "OTHER_SALES_POINT"
  | "GIFT_PRO_OTHER";

export function parseStockOperationMode(raw: string | null | undefined): StockOperationMode {
  if (raw === "transfer" || raw === "issue") return raw;
  return "receive";
}

export function policyHintForMode(
  mode: StockOperationMode,
  ctx: { isBotaUser: boolean; hubConfigured: boolean },
): string {
  switch (mode) {
    case "receive":
      if (ctx.isBotaUser) {
        return "At Bota, record loose (kg) receipts here. Bottled stock normally arrives via consignment transfers from collection points.";
      }
      return "Record production or inbound stock. Loose products require a storage location. Bottled products at collection points can be received directly; Bota intake uses transfers.";
    case "transfer":
      if (ctx.isBotaUser) {
        return "Confirm consignment transfers from collection points. Match actual received units to the sender voucher before posting stock at Bota.";
      }
      return "Bottled palm oil is transferred to Bota (hub) for retail sale. Clerks raise vouchers; sender supervisors approve dispatch; Bota validates receipt.";
    case "issue":
      if (ctx.isBotaUser) {
        return "Post gift, PRO, or other non-sale outbound from Bota. Customer bottled sales use Bottled Palm Oil sales; loose customer sales use Sales (POS).";
      }
      return "Customer sales are posted on Sales or Bottled Palm Oil sales, not here. Collection-point staff use transfers to send bottled stock to Bota.";
    default:
      return "";
  }
}

export function bottledDirectReceiptAllowed(
  salesPointId: number,
  hubId: number | null,
): boolean {
  return !hubBlocksVariantReceipt(salesPointId, hubId);
}

export function transferDestinationSalesPointIds(
  productForm: ProductForm,
  hubId: number | null,
): { fixedHubOnly: boolean; hubId: number | null } {
  if (productForm === "BOTTLED") {
    return { fixedHubOnly: true, hubId };
  }
  return { fixedHubOnly: false, hubId: null };
}

export function issueDestinationsForProduct(
  productForm: ProductForm,
  isBotaUser: boolean,
): StockIssueDestination[] {
  if (productForm === "BOTTLED" && isBotaUser) {
    return ["CUSTOMER_SALE", "GIFT_PRO_OTHER"];
  }
  if (productForm === "LOOSE") {
    return ["CUSTOMER_SALE", "OTHER_SALES_POINT", "GIFT_PRO_OTHER"];
  }
  return [];
}

export { requiresStorageLocation };
