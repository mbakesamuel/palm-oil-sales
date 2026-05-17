import "server-only";

import type { PrismaClient } from "@prisma/client";

function pad(num: number, len: number) {
  return String(num).padStart(len, "0");
}

type InvoiceDb = Pick<PrismaClient, "commercialService" | "commercialInvoiceSequence">;

/** Per commercial service and calendar year (`{prefix}-{year}-{000001}`). */
export async function allocateInvoiceNo(
  db: InvoiceDb,
  commercialServiceId: string,
  soldAt: Date,
): Promise<string> {
  const year = soldAt.getFullYear();

  const cs = await db.commercialService.findUnique({
    where: { id: commercialServiceId },
    select: { invoicePrefix: true, isActive: true },
  });
  if (!cs?.isActive) {
    throw new Error("Commercial service is missing or inactive.");
  }

  const seq = await db.commercialInvoiceSequence.upsert({
    where: {
      commercialServiceId_calendarYear: {
        commercialServiceId,
        calendarYear: year,
      },
    },
    create: { commercialServiceId, calendarYear: year, nextNumber: 2 },
    update: { nextNumber: { increment: 1 } },
    select: { nextNumber: true },
  });

  const allocated = seq.nextNumber - 1;
  return `${cs.invoicePrefix}-${year}-${pad(allocated, 6)}`;
}
