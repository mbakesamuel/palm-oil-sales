import { getPrismaClient } from "@/lib/prisma";
import { DeliveryOrdersClient } from "./DeliveryOrdersClient";
import { createDeliveryOrder, deleteDeliveryOrder } from "./actions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function DeliveryOrdersPage() {
  const prisma = getPrismaClient();

  const [customers, products, orders] = await Promise.all([
    prisma.customer.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
      take: 200,
    }),
    prisma.product.findMany({
      orderBy: [{ productName: "asc" }],
      select: {
        productId: true,
        productName: true,
        productCat: { select: { productCat: true } },
      },
      take: 200,
    }),
    prisma.deliveryOrder.findMany({
      orderBy: { dateIssued: "desc" },
      take: 100,
      select: {
        id: true,
        deliveryOrderNo: true,
        dateIssued: true,
        customer: { select: { name: true } },
        _count: { select: { details: true } },
      },
    }),
  ]);

  return (
    <DeliveryOrdersClient
      customers={customers}
      products={products}
      orders={orders.map((o) => ({
        id: o.id,
        deliveryOrderNo: o.deliveryOrderNo,
        dateIssuedIso: o.dateIssued.toISOString(),
        customerName: o.customer.name,
        lineCount: o._count.details,
      }))}
      createDeliveryOrderAction={createDeliveryOrder}
      deleteDeliveryOrderAction={deleteDeliveryOrder}
    />
  );
}
