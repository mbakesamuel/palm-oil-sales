import { getPrismaClient } from "@/lib/prisma";
import { prismaRetry } from "@/lib/prisma-retry";
import { listCustomerTypeDefinitions } from "@/lib/customer-types/catalog";
import {
  deleteProductUnitPriceSchedule,
  saveProductUnitPriceSchedule,
} from "./actions";
import { ProductPricingClient } from "./ProductPricingClient";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function ProductPricingPage() {
  const prisma = getPrismaClient();
  const [schedules, products, customerTypeOptions] = await Promise.all([
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
          customerTypeDefinition: { select: { id: true, code: true, name: true } },
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
    listCustomerTypeDefinitions({ activeOnly: true }),
  ]);

  const scheduleModels = schedules.map((r) => ({
    id: r.id,
    productId: r.productId,
    productName: r.product.productName,
    productCatId: r.product.productCatId,
    isMainCategory: r.product.productCat?.isMain === true,
    customerTypeId: r.customerTypeId,
    customerTypeName: r.customerTypeDefinition?.name ?? null,
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
        products={productOpts}
        schedules={scheduleModels}
        customerTypeOptions={customerTypeOptions}
        saveScheduleAction={saveProductUnitPriceSchedule}
        deleteScheduleAction={deleteProductUnitPriceSchedule}
      />
    </div>
  );
}
