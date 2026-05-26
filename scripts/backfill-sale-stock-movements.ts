/**
 * One-off backfill: post one SALE StockMovement per SaleLine for every VALIDATED
 * Sale that does not yet have any SALE movement keyed to its id, and decrement
 * StockBalance accordingly.
 *
 * Idempotent: rerunning skips sales that already have backfilled movements.
 * Chronological: oldest sales first, so transient insufficient-stock failures
 * surface against the right document.
 *
 * Run: npx tsx scripts/backfill-sale-stock-movements.ts
 */

import "dotenv/config";
import { Prisma, PrismaClient, ProductForm } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required (see .env).");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

type Tx = Prisma.TransactionClient;

async function applySaleMovement(
  tx: Tx,
  input: {
    salesPointId: number;
    productId: number;
    qty: Prisma.Decimal;
    occurredAt: Date;
    userId: string;
    saleId: string;
  },
): Promise<void> {
  const delta = input.qty.abs();
  if (delta.lte(0)) return;

  await tx.stockMovement.create({
    data: {
      salesPointId: input.salesPointId,
      productId: input.productId,
      kind: "SALE",
      qty: delta,
      occurredAt: input.occurredAt,
      userId: input.userId,
      sourceKind: "SALE",
      sourceId: input.saleId,
      notes: "Backfill of historical validated sale",
    },
  });

  const updated = await tx.stockBalance.updateMany({
    where: {
      salesPointId: input.salesPointId,
      productId: input.productId,
      qty: { gte: delta },
    },
    data: { qty: { decrement: delta } },
  });

  if (updated.count === 0) {
    const balance = await tx.stockBalance.findUnique({
      where: {
        salesPointId_productId: {
          salesPointId: input.salesPointId,
          productId: input.productId,
        },
      },
      select: { qty: true },
    });
    const available = balance?.qty ?? new Prisma.Decimal(0);
    throw new Error(
      `Insufficient stock at salesPoint ${input.salesPointId} for product ${input.productId}: requested ${delta.toString()}, available ${available.toString()}.`,
    );
  }
}

async function main() {
  console.log("Loading validated sales without SALE movements (oldest first)…");

  const sales = await prisma.sale.findMany({
    where: {
      status: "VALIDATED",
      salesPointId: { not: null },
    },
    select: {
      id: true,
      invoiceNo: true,
      soldAt: true,
      salesPointId: true,
      validatedByUserId: true,
      createdByUserId: true,
      lines: {
        select: {
          productId: true,
          qtyKg: true,
          qtyUnits: true,
          product: { select: { form: true, productName: true } },
        },
      },
      salesPoint: { select: { name: true } },
    },
    orderBy: [{ soldAt: "asc" }, { createdAt: "asc" }],
  });

  console.log(`Candidate validated sales: ${sales.length}`);

  let processed = 0;
  let skipped = 0;
  let failed = 0;
  let movementsCreated = 0;

  for (const sale of sales) {
    const existing = await prisma.stockMovement.count({
      where: { sourceKind: "SALE", sourceId: sale.id, kind: "SALE" },
    });
    if (existing > 0) {
      skipped += 1;
      continue;
    }

    const userId = sale.validatedByUserId ?? sale.createdByUserId;
    if (!userId) {
      console.warn(
        `[skip] ${sale.invoiceNo}: no validatedByUserId or createdByUserId.`,
      );
      skipped += 1;
      continue;
    }
    const salesPointId = sale.salesPointId;
    if (salesPointId == null) {
      console.warn(`[skip] ${sale.invoiceNo}: no salesPointId.`);
      skipped += 1;
      continue;
    }

    try {
      const created = await prisma.$transaction(
        async (tx) => {
          let count = 0;
          for (const line of sale.lines) {
            const qty =
              line.product.form === ProductForm.LOOSE
                ? new Prisma.Decimal(line.qtyKg)
                : new Prisma.Decimal(line.qtyUnits ?? line.qtyKg);
            if (qty.lte(0)) continue;
            await applySaleMovement(tx, {
              salesPointId,
              productId: line.productId,
              qty,
              occurredAt: sale.soldAt,
              userId,
              saleId: sale.id,
            });
            count += 1;
          }
          return count;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );

      processed += 1;
      movementsCreated += created;
      console.log(
        `[ok]   ${sale.invoiceNo} @ ${sale.salesPoint?.name ?? "?"}: ${created} movement(s) posted`,
      );
    } catch (err) {
      failed += 1;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[fail] ${sale.invoiceNo}: ${msg}`);
    }
  }

  console.log("\nDone.");
  console.log(`Sales processed:           ${processed}`);
  console.log(`Sales skipped:             ${skipped}`);
  console.log(`Sales failed:              ${failed}`);
  console.log(`Stock movements inserted:  ${movementsCreated}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
