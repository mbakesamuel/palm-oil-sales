import { revalidatePath } from "next/cache";

export function revalidateStockPaths() {
  revalidatePath("/stock");
  revalidatePath("/stock/receipts");
  revalidatePath("/stock/movements");
  revalidatePath("/stock/issues");
  revalidatePath("/reports/stock-on-hand");
  revalidatePath("/reports/stock-vs-commitments");
  revalidatePath("/reports/bpo");
  revalidatePath("/reports/bpo-stock-cross");
}
