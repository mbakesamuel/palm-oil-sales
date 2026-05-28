import "server-only";

import { Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

export async function assertStorageLocationForSalesPoint(
  tx: Tx,
  salesPointId: number,
  storageLocationId: number,
): Promise<void> {
  const loc = await tx.storageLocation.findFirst({
    where: { id: storageLocationId, salesPointId },
    select: { id: true },
  });
  if (!loc) {
    throw new Error("Storage location does not belong to the selected sales point.");
  }
}

export async function resolveDefaultStorageLocationId(
  tx: Tx,
  salesPointId: number,
): Promise<number> {
  const loc = await tx.storageLocation.findFirst({
    where: { salesPointId, isDefault: true },
    select: { id: true, name: true },
  });
  if (!loc) {
    throw new Error(
      "No default storage location configured for this sales point. Add one under Sales points.",
    );
  }
  return loc.id;
}

export async function ensureDefaultStorageLocation(
  tx: Tx,
  salesPointId: number,
  name = "General",
): Promise<number> {
  const existing = await tx.storageLocation.findFirst({
    where: { salesPointId, isDefault: true },
    select: { id: true },
  });
  if (existing) return existing.id;

  const created = await tx.storageLocation.create({
    data: { salesPointId, name, isDefault: true },
    select: { id: true },
  });
  return created.id;
}
