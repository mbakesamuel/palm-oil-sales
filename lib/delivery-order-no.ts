import "server-only";

import type { Prisma } from "@prisma/client";
import { getPrismaClient } from "@/lib/prisma";

function pad(num: number, len: number) {
  return String(num).padStart(len, "0");
}

type DeliveryOrderNoClient =
  | ReturnType<typeof getPrismaClient>
  | Prisma.TransactionClient;

export async function allocateDeliveryOrderNo(
  db: DeliveryOrderNoClient,
  issuedAt: Date,
): Promise<string> {
  const year = issuedAt.getFullYear();
  const seq = await db.deliveryOrderSequence.upsert({
    where: { id: "default" },
    create: { id: "default", nextNumber: 2 },
    update: { nextNumber: { increment: 1 } },
    select: { nextNumber: true },
  });
  const allocated = seq.nextNumber - 1;
  return `DO-${year}-${pad(allocated, 6)}`;
}
