import { getPrismaClient } from "@/lib/prisma";
import { prismaRetry } from "@/lib/prisma-retry";
import {
  deleteBpoVariant,
  deleteBpoVariantPrice,
  saveBpoVariant,
  saveBpoVariantPrice,
} from "./actions";
import { BpoVariantsClient } from "./BpoVariantsClient";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function BpoVariantsPage() {
  const prisma = getPrismaClient();
  const [products, variants, prices] = await Promise.all([
    prismaRetry(() =>
      prisma.product.findMany({
        where: { isBottledPalmOil: true },
        orderBy: { productName: "asc" },
        select: { productId: true, productName: true },
      }),
    ),
    prismaRetry(() =>
      prisma.productVariant.findMany({
        where: { product: { isBottledPalmOil: true } },
        orderBy: [{ product: { productName: "asc" } }, { name: "asc" }],
        include: { product: { select: { productName: true } } },
      }),
    ),
    prismaRetry(() =>
      prisma.productVariantPriceSchedule.findMany({
        where: { productVariant: { product: { isBottledPalmOil: true } } },
        orderBy: [{ productVariant: { name: "asc" } }, { effectiveFrom: "desc" }],
        include: {
          productVariant: {
            select: { name: true, product: { select: { productName: true } } },
          },
        },
      }),
    ),
  ]);

  return (
    <BpoVariantsClient
      products={products}
      variants={variants.map((v) => ({
        id: v.id,
        productId: v.productId,
        productName: v.product.productName,
        name: v.name,
        unitLabel: v.unitLabel,
        unitQuantity: v.unitQuantity?.toString() ?? null,
        isActive: v.isActive,
      }))}
      prices={prices.map((p) => ({
        id: p.id,
        productVariantId: p.productVariantId,
        variantLabel: `${p.productVariant.product.productName} - ${p.productVariant.name}`,
        effectiveFromIso: p.effectiveFrom.toISOString().slice(0, 10),
        unitPriceExTax: p.unitPriceExTax.toString(),
      }))}
      saveVariantAction={saveBpoVariant}
      deleteVariantAction={deleteBpoVariant}
      savePriceAction={saveBpoVariantPrice}
      deletePriceAction={deleteBpoVariantPrice}
    />
  );
}
