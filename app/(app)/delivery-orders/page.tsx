import { getPrismaClient } from "@/lib/prisma";
import { prismaRetry } from "@/lib/prisma-retry";
import { getServerSession } from "@/lib/auth-server";
import { getPermissionsForSession } from "@/lib/access-control";
import {
  customerWhereForScope,
  productWhereForScope,
  resolveServiceScope,
} from "@/lib/service-scope";
import { DeliveryOrdersClient } from "./DeliveryOrdersClient";
import {
  deleteDeliveryOrder,
  listPendingDeliveryOrders,
  loadDeliveryOrderByNo,
  previewDeliveryOrderTaxes,
  previewStockOnHandForDeliveryOrder,
  saveDeliveryOrder,
  validateDeliveryOrder,
} from "./actions";
import { previewProductUnitPrice } from "@/lib/pricing/preview-action";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function DeliveryOrdersPage() {
  const prisma = getPrismaClient();
  const session = await getServerSession();
  const scope = session ? resolveServiceScope(session) : { mode: "all" as const };
  const canValidateDeliveryOrder =
    session != null
      ? (await getPermissionsForSession(session))["ui:validate-delivery-orders"]
      : false;
  const productWhere = productWhereForScope(scope, {
    productCat: { isBottled: false },
  });
  const customerWhere = customerWhereForScope(scope) ?? {};

  const [customers, products, salesPoints] = await Promise.all([
    prismaRetry(() =>
      prisma.customer.findMany({
        where: customerWhere,
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
        where: productWhere,
        orderBy: [{ productName: "asc" }],
        select: {
          productId: true,
          productName: true,
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
        vatApplies: c.taxRegime?.vatApplies ?? false,
      }))}
      products={products}
      salesPoints={salesPoints}
      previewDeliveryOrderTaxesAction={previewDeliveryOrderTaxes}
      loadDeliveryOrderByNo={loadDeliveryOrderByNo}
      saveDeliveryOrder={saveDeliveryOrder}
      deleteDeliveryOrder={deleteDeliveryOrder}
      validateDeliveryOrder={validateDeliveryOrder}
      previewProductUnitPriceAction={previewProductUnitPrice}
      previewStockOnHandAction={previewStockOnHandForDeliveryOrder}
      listPendingDeliveryOrdersAction={listPendingDeliveryOrders}
      canValidateDeliveryOrder={canValidateDeliveryOrder}
    />
  );
}
