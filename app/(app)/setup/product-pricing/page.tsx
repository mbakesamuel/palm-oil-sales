import { getPrismaClient } from "@/lib/prisma";
import { prismaRetry } from "@/lib/prisma-retry";
import {
  deleteProductUnitPriceSchedule,
  saveProductUnitPriceSchedule,
} from "./actions";
import { ProductPricingClient } from "./ProductPricingClient";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function ProductPricingPage() {
  const prisma = getPrismaClient();
  const [schedules, products] = await Promise.all([
    prismaRetry(() =>
      prisma.productUnitPriceSchedule.findMany({
        orderBy: [{ productId: "asc" }, { effectiveFrom: "desc" }],
        include: {
          product: { select: { productName: true, productCatId: true } },
        },
      }),
    ),
    prismaRetry(() =>
      prisma.product.findMany({
        orderBy: { productName: "asc" },
        select: { productId: true, productName: true, productCatId: true },
      }),
    ),
  ]);

  return (
    <ProductPricingClient
      products={products}
      schedules={schedules.map((r) => ({
        id: r.id,
        productId: r.productId,
        productName: r.product.productName,
        productCatId: r.product.productCatId,
        customerType: r.customerType,
        effectiveFromIso: r.effectiveFrom.toISOString().slice(0, 10),
        unitPriceExTax: r.unitPriceExTax.toString(),
      }))}
      saveScheduleAction={saveProductUnitPriceSchedule}
      deleteScheduleAction={deleteProductUnitPriceSchedule}
    />
  );
}
