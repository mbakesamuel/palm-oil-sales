import "server-only";

import { Prisma, TaxRateVariant } from "@prisma/client";
import { getPrismaClient } from "@/lib/prisma";
import { prismaDateToIso } from "@/lib/posting-calendar";
import { SALES_TAX_CODE, VAT_TAX_CODE } from "@/lib/tax/constants";

type PrismaForTax = ReturnType<typeof getPrismaClient>;

export type TaxScheduleRowView = {
  id: string;
  variant: TaxRateVariant;
  rate: string;
  effectiveFromIso: string;
};

export async function findEffectiveRateRow(
  prisma: PrismaForTax,
  taxTypeId: string,
  variant: TaxRateVariant,
  asOf: Date,
) {
  const dayIso = prismaDateToIso(asOf);
  const asOfStartUtc = new Date(`${dayIso}T00:00:00.000Z`);
  return prisma.taxRateSchedule.findFirst({
    where: { taxTypeId, variant, effectiveFrom: { lte: asOfStartUtc } },
    orderBy: { effectiveFrom: "desc" },
  });
}

export async function listScheduleRowsForTaxCode(
  prisma: PrismaForTax,
  code: string,
  variant?: TaxRateVariant,
): Promise<TaxScheduleRowView[]> {
  const taxType = await prisma.taxType.findUnique({
    where: { code },
    select: { id: true },
  });
  if (!taxType) return [];

  const rows = await prisma.taxRateSchedule.findMany({
    where: {
      taxTypeId: taxType.id,
      ...(variant ? { variant } : {}),
    },
    orderBy: [{ effectiveFrom: "desc" }, { variant: "asc" }],
  });

  return rows.map((r) => ({
    id: r.id,
    variant: r.variant,
    rate: r.rate.toString(),
    effectiveFromIso: r.effectiveFrom.toISOString().slice(0, 10),
  }));
}

export async function getEffectiveRatesSummary(asOf: Date = new Date()) {
  const prisma = getPrismaClient();
  const [vatType, satType] = await Promise.all([
    prisma.taxType.findUnique({ where: { code: VAT_TAX_CODE }, select: { id: true } }),
    prisma.taxType.findUnique({ where: { code: SALES_TAX_CODE }, select: { id: true } }),
  ]);

  const vatRow = vatType
    ? await findEffectiveRateRow(prisma, vatType.id, TaxRateVariant.DEFAULT, asOf)
    : null;

  const satVariants = [
    TaxRateVariant.REAL,
    TaxRateVariant.SIMPLIFIED,
    TaxRateVariant.NO_TAXPAYER_ID,
  ] as const;

  const satRates: Partial<Record<(typeof satVariants)[number], string>> = {};
  if (satType) {
    for (const variant of satVariants) {
      const row = await findEffectiveRateRow(prisma, satType.id, variant, asOf);
      if (row) satRates[variant] = row.rate.toString();
    }
  }

  return {
    vatRate: vatRow?.rate.toString() ?? null,
    satRates,
  };
}

export function decimalToPercentLabel(rate: string | Prisma.Decimal | null): string | null {
  if (rate == null) return null;
  const n = Number.parseFloat(String(rate));
  if (!Number.isFinite(n)) return null;
  return (n * 100).toFixed(2).replace(/\.?0+$/, "");
}
