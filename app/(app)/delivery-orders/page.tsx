import { getPrismaClient } from "@/lib/prisma";
import { prismaRetry } from "@/lib/prisma-retry";
import { getServerSession } from "@/lib/auth-server";
import {
  canDraftDeliveryOrders,
  getPermissionsForSession,
} from "@/lib/access-control";
import { loadAuthSessionByUserId } from "@/lib/load-auth-session";
import {
  customerWhereForScope,
  productWhereForScope,
  resolveServiceScope,
} from "@/lib/service-scope";
import { DeliveryOrdersClient } from "./DeliveryOrdersClient";
import {
  deleteDeliveryOrder,
  listPendingDeliveryOrders,
  cancelValidatedDeliveryOrder,
  loadDeliveryOrderByNo,
  previewDeliveryOrderTaxes,
  previewStockOnHandForDeliveryOrder,
  saveDeliveryOrder,
  validateDeliveryOrder,
} from "./actions";
import { listPaymentMethodDefinitions } from "@/lib/payment-methods/catalog";
import { previewProductUnitPrice } from "@/lib/pricing/preview-action";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function DeliveryOrdersPage(props: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const prisma = getPrismaClient();
  const cookieSession = await getServerSession();
  const session = cookieSession?.userId
    ? await loadAuthSessionByUserId(cookieSession.userId)
    : null;
  const scope = session ? resolveServiceScope(session) : { mode: "all" as const };
  const perms = session ? await getPermissionsForSession(session) : null;
  const canValidateDeliveryOrder = Boolean(perms?.["ui:validate-delivery-orders"]);
  const canAccessValidationQueue = Boolean(
    perms?.["route:/delivery-orders/validation-queue"],
  );
  const canDraftDeliveryOrder =
    session != null && perms != null
      ? canDraftDeliveryOrders(perms, session)
      : false;
  const commercialLineLabel = session?.commercialService?.name ?? null;
  const sp = (await props.searchParams) ?? {};
  const lookupNoRaw = Array.isArray(sp.no) ? sp.no[0] : sp.no;
  const initialLookupNo = typeof lookupNoRaw === "string" ? lookupNoRaw : "";
  const productWhere = productWhereForScope(scope);
  const customerWhere = customerWhereForScope(scope) ?? {};

  const [customers, products, salesPoints, paymentMethods] = await Promise.all([
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
    listPaymentMethodDefinitions({
      activeOnly: true,
      kinds: ["SIMPLE", "CHEQUE"],
    }),
  ]);

  return (
    <DeliveryOrdersClient
      paymentMethods={paymentMethods}
      initialLookupNo={initialLookupNo}
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
      cancelValidatedDeliveryOrder={cancelValidatedDeliveryOrder}
      previewProductUnitPriceAction={previewProductUnitPrice}
      previewStockOnHandAction={previewStockOnHandForDeliveryOrder}
      listPendingDeliveryOrdersAction={listPendingDeliveryOrders}
      canValidateDeliveryOrder={canValidateDeliveryOrder}
      canAccessValidationQueue={canAccessValidationQueue}
      canDraftDeliveryOrder={canDraftDeliveryOrder}
      commercialLineLabel={commercialLineLabel}
    />
  );
}
