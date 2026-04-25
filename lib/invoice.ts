import "server-only";

import { getPrismaClient } from "@/lib/prisma";

function pad(num: number, len: number) {
  return String(num).padStart(len, "0");
}

export async function allocateInvoiceNo(prefix: string, soldAt: Date): Promise<string> {
  const year = soldAt.getFullYear();

  const prisma = getPrismaClient();
  const seq = await prisma.invoiceSequence.upsert({
    where: { id: "default" },
    create: { id: "default", nextNumber: 2 },
    update: { nextNumber: { increment: 1 } },
    select: { nextNumber: true },
  });

  // When created: nextNumber=2, meaning we just allocated 1.
  const allocated = seq.nextNumber - 1;
  return `${prefix}-${year}-${pad(allocated, 6)}`;
}

