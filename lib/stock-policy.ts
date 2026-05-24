import "server-only";

import type { Prisma } from "@prisma/client";
import { HUB_SALES_POINT_NAME } from "@/lib/stock-policy-shared";

export {
  HUB_SALES_POINT_NAME,
  hubBlocksVariantReceipt,
  movementTypeForLegacyBpo,
  requiresStorageLocation,
} from "@/lib/stock-policy-shared";

type PrismaClientLike = {
  salesPoint: {
    findFirst: (args: {
      where: { name: { equals: string; mode: "insensitive" } };
      select: { id: true };
    }) => Promise<{ id: number } | null>;
  };
};

export async function getHubSalesPointId(
  prisma: Prisma.TransactionClient | PrismaClientLike,
): Promise<number | null> {
  const hub = await prisma.salesPoint.findFirst({
    where: { name: { equals: HUB_SALES_POINT_NAME, mode: "insensitive" } },
    select: { id: true },
  });
  return hub?.id ?? null;
}

export async function ensureHubSalesPointId(
  prisma: Prisma.TransactionClient | PrismaClientLike,
): Promise<number> {
  const id = await getHubSalesPointId(prisma);
  if (id == null) {
    throw new Error(
      `Create a sales point named "${HUB_SALES_POINT_NAME}" before managing hub stock transfers.`,
    );
  }
  return id;
}
