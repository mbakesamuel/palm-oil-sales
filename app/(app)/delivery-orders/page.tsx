import { getPrismaClient } from "@/lib/prisma";
import { prismaRetry } from "@/lib/prisma-retry";
import { DeliveryOrdersClient } from "./DeliveryOrdersClient";
import {
  deleteDeliveryOrder,
  loadDeliveryOrderByNo,
  previewDeliveryOrderTaxes,
  saveDeliveryOrderDetails,
  saveDeliveryOrderHeader,
  saveDeliveryOrderPayments,
  validateDeliveryOrder,
} from "./actions";
import { previewProductUnitPrice } from "@/lib/pricing/preview-action";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function DeliveryOrdersPage() {
  const prisma = getPrismaClient();

  const [customers, products, salesPoints] = await Promise.all([
    prismaRetry(() =>
      prisma.customer.findMany({
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          taxRegime: { select: { vatApplies: true } },
        },
        take: 200,
      }),
    ),
    prismaRetry(() =>
      prisma.product.findMany({
        where: { isBottledPalmOil: false },
        orderBy: [{ productName: "asc" }],
        select: {
          productId: true,
          productName: true,
          productCat: { select: { productCat: true } },
        },
        take: 200,
      }),
    ),
    prismaRetry(() =>
      prisma.salesPoint.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
    ),
  ]);

  return (
    <DeliveryOrdersClient
      customers={customers.map((c) => ({
        id: c.id,
        name: c.name,
        vatApplies: c.taxRegime.vatApplies,
      }))}
      products={products}
      salesPoints={salesPoints}
      previewDeliveryOrderTaxesAction={previewDeliveryOrderTaxes}
      loadDeliveryOrderByNo={loadDeliveryOrderByNo}
      saveDeliveryOrderHeader={saveDeliveryOrderHeader}
      saveDeliveryOrderDetails={saveDeliveryOrderDetails}
      saveDeliveryOrderPayments={saveDeliveryOrderPayments}
      deleteDeliveryOrder={deleteDeliveryOrder}
      validateDeliveryOrder={validateDeliveryOrder}
      previewProductUnitPriceAction={previewProductUnitPrice}
    />
  );
}
