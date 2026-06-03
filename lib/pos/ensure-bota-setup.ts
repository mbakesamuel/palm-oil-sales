import type { PrismaClient } from "@prisma/client";
import {
  BOTA_SALES_POINT_NAME,
  BOTTLE_OIL_STORE_LOCATION_NAME,
  WALK_IN_CUSTOMER_NAME,
} from "@/lib/pos/sale-product-mode";

/**
 * Ensures Bota sales point, Bottle Oil Store location, and walk-in customer exist.
 * Safe to call from seed or one-off setup scripts.
 */
export async function ensureBotaPosSetup(prisma: PrismaClient) {
  const service = await prisma.commercialService.findFirst({
    orderBy: { name: "asc" },
    select: { id: true },
  });
  if (!service) return;

  const mill =
    (await prisma.mill.findFirst({ select: { id: true } })) ??
    (await prisma.mill.create({
      data: { name: "Main mill" },
      select: { id: true },
    }));

  let bota = await prisma.salesPoint.findFirst({
    where: { name: { equals: BOTA_SALES_POINT_NAME, mode: "insensitive" } },
    select: { id: true },
  });
  if (!bota) {
    bota = await prisma.salesPoint.create({
      data: { name: BOTA_SALES_POINT_NAME, millId: mill.id },
      select: { id: true },
    });
  }

  const storeExists = await prisma.storageLocation.findFirst({
    where: {
      salesPointId: bota.id,
      name: { equals: BOTTLE_OIL_STORE_LOCATION_NAME, mode: "insensitive" },
    },
    select: { id: true },
  });
  if (!storeExists) {
    await prisma.storageLocation.create({
      data: {
        salesPointId: bota.id,
        name: BOTTLE_OIL_STORE_LOCATION_NAME,
        isDefault: false,
      },
    });
  }

  const walkIn = await prisma.customer.findFirst({
    where: { name: WALK_IN_CUSTOMER_NAME, commercialServiceId: service.id },
    select: { id: true },
  });
  if (!walkIn) {
    await prisma.customer.create({
      data: {
        commercialServiceId: service.id,
        name: WALK_IN_CUSTOMER_NAME,
        customerType: "RETAIL",
        hasTaxpayerId: false,
      },
    });
  }
}
