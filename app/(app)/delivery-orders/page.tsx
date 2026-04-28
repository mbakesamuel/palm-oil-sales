import { getPrismaClient } from "@/lib/prisma";
import { getOrInitCompanySettings } from "@/lib/settings";
import { DeliveryOrdersClient } from "./DeliveryOrdersClient";
import {
  loadDeliveryOrderByNo,
  saveDeliveryOrderDetails,
  saveDeliveryOrderHeader,
  saveDeliveryOrderPayments,
} from "./actions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function DeliveryOrdersPage() {
  const prisma = getPrismaClient();

  const [customers, products, salesPoints, settings] = await Promise.all([
    prisma.customer.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        taxRegime: { select: { vatApplies: true } },
      },
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
    prisma.salesPoint.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    getOrInitCompanySettings(),
  ]);

  const companyVatRate = settings.vatRate.toString();

  return (
    <DeliveryOrdersClient
      customers={customers.map((c) => ({
        id: c.id,
        name: c.name,
        vatApplies: c.taxRegime.vatApplies,
      }))}
      products={products}
      salesPoints={salesPoints}
      companyVatRate={companyVatRate}
      loadDeliveryOrderByNo={loadDeliveryOrderByNo}
      saveDeliveryOrderHeader={saveDeliveryOrderHeader}
      saveDeliveryOrderDetails={saveDeliveryOrderDetails}
      saveDeliveryOrderPayments={saveDeliveryOrderPayments}
    />
  );
}
