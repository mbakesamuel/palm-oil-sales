import "server-only";

import type { Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

function pad6(num: number) {
  return String(num).padStart(6, "0");
}

async function nextReceiptNumber(tx: Tx, year: number): Promise<number> {
  const row = await tx.stockReceiptSequence.upsert({
    where: { calendarYear: year },
    create: { calendarYear: year, nextNumber: 2 },
    update: { nextNumber: { increment: 1 } },
    select: { nextNumber: true },
  });
  return row.nextNumber - 1;
}

async function nextTransferNumber(tx: Tx, year: number): Promise<number> {
  const row = await tx.stockTransferSequence.upsert({
    where: { calendarYear: year },
    create: { calendarYear: year, nextNumber: 2 },
    update: { nextNumber: { increment: 1 } },
    select: { nextNumber: true },
  });
  return row.nextNumber - 1;
}

async function nextAdjustmentNumber(tx: Tx, year: number): Promise<number> {
  const row = await tx.stockAdjustmentSequence.upsert({
    where: { calendarYear: year },
    create: { calendarYear: year, nextNumber: 2 },
    update: { nextNumber: { increment: 1 } },
    select: { nextNumber: true },
  });
  return row.nextNumber - 1;
}

export async function allocateReceiptNo(tx: Tx, issuedAt: Date): Promise<string> {
  const year = issuedAt.getUTCFullYear();
  const n = await nextReceiptNumber(tx, year);
  return `SR-${year}-${pad6(n)}`;
}

export async function allocateTransferNo(tx: Tx, issuedAt: Date): Promise<string> {
  const year = issuedAt.getUTCFullYear();
  const n = await nextTransferNumber(tx, year);
  return `ST-${year}-${pad6(n)}`;
}

export async function allocateAdjustmentNo(tx: Tx, issuedAt: Date): Promise<string> {
  const year = issuedAt.getUTCFullYear();
  const n = await nextAdjustmentNumber(tx, year);
  return `SA-${year}-${pad6(n)}`;
}
