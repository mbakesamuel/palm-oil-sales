import { getPrismaClient } from "@/lib/prisma";
import { prismaRetry } from "@/lib/prisma-retry";
import { getOrInitCompanySettings } from "@/lib/settings";
import {
  deleteProductUnitPriceSchedule,
  saveProductUnitPriceSchedule,
} from "./actions";
import { ProductPricingClient } from "./ProductPricingClient";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function ProductPricingPage() {
  const prisma = getPrismaClient();
  const [schedules, products, settings] = await Promise.all([
    prismaRetry(() =>
      prisma.productUnitPriceSchedule.findMany({
        orderBy: [{ productId: "asc" }, { effectiveFrom: "desc" }],
        include: {
          product: {
            select: {
              productName: true,
              productCatId: true,
              productCat: { select: { isMain: true, isBottled: true } },
            },
          },
        },
      }),
    ),
    prismaRetry(() =>
      prisma.product.findMany({
        orderBy: { productName: "asc" },
        select: {
          productId: true,
          productName: true,
          productCatId: true,
          productCat: { select: { productCat: true, isMain: true } },
        },
      }),
    ),
    getOrInitCompanySettings(),
  ]);

  const scheduleModels = schedules.map((r) => ({
    id: r.id,
    productId: r.productId,
    productName: r.product.productName,
    productCatId: r.product.productCatId,
    isMainCategory: r.product.productCat?.isMain === true,
    customerType: r.customerType,
    effectiveFromIso: r.effectiveFrom.toISOString().slice(0, 10),
    unitPriceExTax: r.unitPriceExTax.toString(),
  }));

  const productOpts = products.map((p) => ({
    productId: p.productId,
    productName: p.productName,
    productCatId: p.productCatId,
    productCatName: p.productCat?.productCat ?? "(Uncategorised)",
    isMainCategory: p.productCat?.isMain === true,
  }));

  return (
    <div className="space-y-8">
      <ProductPricingClient
        companyName={settings.companyName}
        department={settings.department ?? null}
        logoUrl={settings.logoUrl}
        products={productOpts}
        schedules={scheduleModels}
        saveScheduleAction={saveProductUnitPriceSchedule}
        deleteScheduleAction={deleteProductUnitPriceSchedule}
      />
    </div>
  );
}
