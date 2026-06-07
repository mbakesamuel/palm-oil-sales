import "server-only";

import { getCustomerTypeIdByCode } from "@/lib/customer-types/catalog";
import { productWhereBottled, productWhereNotBottled } from "@/lib/product-form";
import { getPrismaClient } from "@/lib/prisma";
import { resolveCommercialServiceForUserId } from "@/lib/commercial-service";
import type { AuthSession } from "@/lib/auth-session";
import {
  getOrCreatePosPlaceholderCustomer,
  getOrCreateWalkInCustomer,
  PUBLIC_RELATION_POS_CUSTOMER_NAME,
  RATION_POS_CUSTOMER_NAME,
  resolveBotaSalesPointId,
  resolveBottleOilStoreLocationId,
} from "@/lib/pos/sale-product-mode";
import { productWhereForScope, type ServiceScope } from "@/lib/service-scope";

export async function loadPosPageConfig(session: AuthSession, scope: ServiceScope) {
  const prisma = getPrismaClient();
  const productWhere = productWhereForScope(scope);
  const commercialService = await resolveCommercialServiceForUserId(
    prisma,
    session.userId,
  );

  const [retailCustomerTypeId, workerCustomerTypeId] = await Promise.all([
    getCustomerTypeIdByCode("RETAIL"),
    getCustomerTypeIdByCode("WORKER"),
  ]);
  if (!retailCustomerTypeId) {
    throw new Error("Retail customer type is not configured.");
  }
  if (!workerCustomerTypeId) {
    throw new Error("Worker customer type is not configured.");
  }

  const [botaSalesPointId, walkIn, rationPlaceholder, publicRelationPlaceholder, looseProducts, bottledProducts] =
    await Promise.all([
    resolveBotaSalesPointId(prisma),
    getOrCreateWalkInCustomer(prisma, commercialService.id, retailCustomerTypeId),
    getOrCreatePosPlaceholderCustomer(
      prisma,
      commercialService.id,
      RATION_POS_CUSTOMER_NAME,
      workerCustomerTypeId,
    ),
    getOrCreatePosPlaceholderCustomer(
      prisma,
      commercialService.id,
      PUBLIC_RELATION_POS_CUSTOMER_NAME,
      workerCustomerTypeId,
    ),
    prisma.product.findMany({
      where: { ...productWhere, ...productWhereNotBottled() },
      orderBy: [{ productName: "asc" }],
      select: { productId: true, productName: true },
      take: 200,
    }),
    prisma.product.findMany({
      where: { ...productWhere, ...productWhereBottled() },
      orderBy: [{ productName: "asc" }],
      select: { productId: true, productName: true },
      take: 200,
    }),
  ]);

  const bottleOilStoreLocationId =
    botaSalesPointId != null
      ? await resolveBottleOilStoreLocationId(prisma, botaSalesPointId)
      : null;

  return {
    botaSalesPointId,
    bottleOilStoreLocationId,
    walkInCustomerId: walkIn.id,
    rationCustomerId: rationPlaceholder.id,
    publicRelationCustomerId: publicRelationPlaceholder.id,
    looseProducts,
    bottledProducts,
  };
}
