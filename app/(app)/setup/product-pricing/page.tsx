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
          product: { select: { productName: true, productCatId: true, form: true } },
        },
      }),
    ),
    prismaRetry(() =>
      prisma.product.findMany({
        where: { form: { not: "SECONDARY" } },
        orderBy: { productName: "asc" },
        select: { productId: true, productName: true, productCatId: true },
      }),
    ),
    getOrInitCompanySettings(),
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
      <ProductPricingClient
        companyName={settings.companyName}
        department={settings.department ?? null}
        logoUrl={settings.logoUrl}
        products={products}
        schedules={scheduleModels}
        saveScheduleAction={saveProductUnitPriceSchedule}
        deleteScheduleAction={deleteProductUnitPriceSchedule}
      />
    </div>
  );
}
