import "server-only";

import { Prisma } from "@prisma/client";
import { getPrismaClient } from "@/lib/prisma";
import { VAT_TAX_CODE } from "@/lib/tax/constants";

/**
 * Idempotent: ensures VAT TaxType, a default rate schedule from legacy CompanySettings.vatRate,
 * and TaxRegimeTax links for regimes with vatApplies.
 */
export async function ensureTaxCatalogSynced(companySettings: {
  vatRate: Prisma.Decimal;
}) {
  const prisma = getPrismaClient();

  let vatType = await prisma.taxType.findUnique({ where: { code: VAT_TAX_CODE } });
  if (!vatType) {
    vatType = await prisma.taxType.create({
      data: { code: VAT_TAX_CODE, name: "VAT", sortOrder: 0 },
    });
  }

  const scheduleCount = await prisma.taxRateSchedule.count({
    where: { taxTypeId: vatType.id },
  });
  if (scheduleCount === 0) {
    await prisma.taxRateSchedule.create({
      data: {
        taxTypeId: vatType.id,
        rate: companySettings.vatRate,
        effectiveFrom: new Date("1970-01-01T00:00:00.000Z"),
      },
    });
  }

  const regimes = await prisma.taxRegime.findMany({
    where: { vatApplies: true },
    select: { id: true },
  });
  for (const r of regimes) {
    await prisma.taxRegimeTax.upsert({
      where: {
        taxRegimeId_taxTypeId: { taxRegimeId: r.id, taxTypeId: vatType.id },
      },
      create: { taxRegimeId: r.id, taxTypeId: vatType.id },
      update: {},
    });
  }

  await prisma.taxRegimeTax.deleteMany({
    where: {
      taxTypeId: vatType.id,
      taxRegime: { vatApplies: false },
    },
  });
}

/**
 * Sets VAT rate for a given statutory effective calendar day without rewriting other dated rows.
 * Also updates CompanySettings.vatRate as headline display metadata.
 */
export async function upsertVatScheduleForEffectiveDate(rate: Prisma.Decimal, effectiveFrom: Date) {
  const prisma = getPrismaClient();

  let vatType = await prisma.taxType.findUnique({ where: { code: VAT_TAX_CODE } });
  if (!vatType) {
    vatType = await prisma.taxType.create({
      data: { code: VAT_TAX_CODE, name: "VAT", sortOrder: 0 },
    });
  }

  await prisma.taxRateSchedule.upsert({
    where: {
      taxTypeId_effectiveFrom_variant: {
        taxTypeId: vatType.id,
        effectiveFrom,
        variant: "DEFAULT",
      },
    },
    create: {
      taxTypeId: vatType.id,
      variant: "DEFAULT",
      rate,
      effectiveFrom,
    },
    update: { rate },
  });

  await prisma.companySettings.updateMany({
    where: { id: "default" },
    data: { vatRate: rate },
  });
}
