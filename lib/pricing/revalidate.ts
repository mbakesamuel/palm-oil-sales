import { revalidatePath } from "next/cache";

const PRICING_PATHS = [
  "/setup/product-pricing",
  "/setup/product-variants",
  "/setup/bpo-variants",
  "/reports/pricing",
  "/reports/bpo-pricing",
  "/pos",
  "/delivery-orders",
  "/bpo-sales",
] as const;

export function revalidatePricingPaths() {
  for (const p of PRICING_PATHS) revalidatePath(p);
}
