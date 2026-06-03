import "server-only";

import { productWhereBottled, productWhereNotBottled } from "@/lib/product-form";
import { getPrismaClient } from "@/lib/prisma";
import { resolveCommercialServiceForUserId } from "@/lib/commercial-service";
import type { AuthSession } from "@/lib/auth-session";
import {
  getOrCreateWalkInCustomer,
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

  const [botaSalesPointId, walkIn, looseProducts, bottledProducts] = await Promise.all([
    resolveBotaSalesPointId(prisma),
    getOrCreateWalkInCustomer(prisma, commercialService.id),
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
    looseProducts,
    bottledProducts,
  };
}
