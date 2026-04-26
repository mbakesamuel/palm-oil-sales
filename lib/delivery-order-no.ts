import "server-only";

import { getPrismaClient } from "@/lib/prisma";

function pad(num: number, len: number) {
  return String(num).padStart(len, "0");
}

export async function allocateDeliveryOrderNo(issuedAt: Date): Promise<string> {
  const year = issuedAt.getFullYear();
  const prisma = getPrismaClient();
  const seq = await prisma.deliveryOrderSequence.upsert({
    where: { id: "default" },
    create: { id: "default", nextNumber: 2 },
    update: { nextNumber: { increment: 1 } },
    select: { nextNumber: true },
  });
  const allocated = seq.nextNumber - 1;
  return `DO-${year}-${pad(allocated, 6)}`;
}
