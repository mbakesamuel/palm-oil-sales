import { revalidatePath } from "next/cache";

const PRICING_PATHS = [
  "/setup/product-pricing",
  "/setup/product-variants",
  "/reports/pricing",
  "/pos",
  "/delivery-orders",
] as const;

export function revalidatePricingPaths() {
  for (const p of PRICING_PATHS) revalidatePath(p);
}
