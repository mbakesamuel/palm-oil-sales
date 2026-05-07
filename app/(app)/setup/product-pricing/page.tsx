import { getPrismaClient } from "@/lib/prisma";
import { prismaRetry } from "@/lib/prisma-retry";
import {
  deleteProductUnitPriceSchedule,
  saveProductUnitPriceSchedule,
} from "./actions";
import { PricingReportPrintButton } from "@/app/(app)/setup/product-pricing/PricingReportPrintButton";
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

  const scheduleModels = schedules.map((r) => ({
    id: r.id,
    productId: r.productId,
    productName: r.product.productName,
    productCatId: r.product.productCatId,
    customerType: r.customerType,
    effectiveFromIso: r.effectiveFrom.toISOString().slice(0, 10),
    unitPriceExTax: r.unitPriceExTax.toString(),
  }));

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-end">
        <PricingReportPrintButton />
      </div>
      <ProductPricingClient
        products={products}
        schedules={scheduleModels}
        saveScheduleAction={saveProductUnitPriceSchedule}
        deleteScheduleAction={deleteProductUnitPriceSchedule}
      />
    </div>
  );
}
