import "server-only";

import { Prisma } from "@prisma/client";
import { getPrismaClient } from "@/lib/prisma";
import { prismaRetry } from "@/lib/prisma-retry";

const RETRY = { retries: 5, baseDelayMs: 400 } as const;

const FLAT_PCT = new Prisma.Decimal(100).div(12).toDecimalPlaces(6);

export function defaultProfilePctData() {
  return {
    pctM01: FLAT_PCT,
    pctM02: FLAT_PCT,
    pctM03: FLAT_PCT,
    pctM04: FLAT_PCT,
    pctM05: FLAT_PCT,
    pctM06: FLAT_PCT,
    pctM07: FLAT_PCT,
    pctM08: FLAT_PCT,
    pctM09: FLAT_PCT,
    pctM10: FLAT_PCT,
    pctM11: FLAT_PCT,
    pctM12: FLAT_PCT,
  };
}

export async function getOrInitProductSalesBudgetMonthPhaseProfile(
  financialYear: number,
  productId: number,
) {
  const prisma = getPrismaClient();

  const existing = await prismaRetry(
    () =>
      prisma.productSalesBudgetMonthPhaseProfile.findUnique({
        where: {
          financialYear_productId: { financialYear, productId },
        },
      }),
    RETRY,
  );

  if (existing) return existing;

  try {
    return await prismaRetry(
      () =>
        prisma.productSalesBudgetMonthPhaseProfile.create({
          data: {
            financialYear,
            productId,
            ...defaultProfilePctData(),
          },
        }),
      RETRY,
    );
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const row = await prismaRetry(
        () =>
          prisma.productSalesBudgetMonthPhaseProfile.findUnique({
            where: {
              financialYear_productId: { financialYear, productId },
            },
          }),
        RETRY,
      );
      if (row) return row;
    }
    throw e;
  }
}

/** Load or create phase profiles for all given products in one FY (avoids N+1 on setup page). */
export async function batchGetOrInitProfilesForProducts(
  financialYear: number,
  productIds: number[],
): Promise<Map<number, { pctM01: Prisma.Decimal; pctM02: Prisma.Decimal; pctM03: Prisma.Decimal; pctM04: Prisma.Decimal; pctM05: Prisma.Decimal; pctM06: Prisma.Decimal; pctM07: Prisma.Decimal; pctM08: Prisma.Decimal; pctM09: Prisma.Decimal; pctM10: Prisma.Decimal; pctM11: Prisma.Decimal; pctM12: Prisma.Decimal }>> {
  const prisma = getPrismaClient();
  const uniqueIds = [...new Set(productIds)].filter((id) => Number.isFinite(id));
  const out = new Map<
    number,
    {
      pctM01: Prisma.Decimal;
      pctM02: Prisma.Decimal;
      pctM03: Prisma.Decimal;
      pctM04: Prisma.Decimal;
      pctM05: Prisma.Decimal;
      pctM06: Prisma.Decimal;
      pctM07: Prisma.Decimal;
      pctM08: Prisma.Decimal;
      pctM09: Prisma.Decimal;
      pctM10: Prisma.Decimal;
      pctM11: Prisma.Decimal;
      pctM12: Prisma.Decimal;
    }
  >();

  if (uniqueIds.length === 0) return out;

  const found = await prismaRetry(
    () =>
      prisma.productSalesBudgetMonthPhaseProfile.findMany({
        where: { financialYear, productId: { in: uniqueIds } },
      }),
    RETRY,
  );

  for (const row of found) {
    out.set(row.productId, row);
  }

  const missing = uniqueIds.filter((id) => !out.has(id));
  for (const productId of missing) {
    const row = await getOrInitProductSalesBudgetMonthPhaseProfile(financialYear, productId);
    out.set(productId, row);
  }

  return out;
}

export function profileRowToPercentDecimals(row: {
  pctM01: Prisma.Decimal;
  pctM02: Prisma.Decimal;
  pctM03: Prisma.Decimal;
  pctM04: Prisma.Decimal;
  pctM05: Prisma.Decimal;
  pctM06: Prisma.Decimal;
  pctM07: Prisma.Decimal;
  pctM08: Prisma.Decimal;
  pctM09: Prisma.Decimal;
  pctM10: Prisma.Decimal;
  pctM11: Prisma.Decimal;
  pctM12: Prisma.Decimal;
}): Prisma.Decimal[] {
  return [
    row.pctM01,
    row.pctM02,
    row.pctM03,
    row.pctM04,
    row.pctM05,
    row.pctM06,
    row.pctM07,
    row.pctM08,
    row.pctM09,
    row.pctM10,
    row.pctM11,
    row.pctM12,
  ];
}

export function sumProfilePercents(pcts: Prisma.Decimal[]): Prisma.Decimal {
  return pcts.reduce((a, b) => a.add(b), new Prisma.Decimal(0));
}
