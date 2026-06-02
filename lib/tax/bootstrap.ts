import "server-only";

import { Prisma, TaxRateVariant } from "@prisma/client";
import { getPrismaClient } from "@/lib/prisma";
import { SALES_TAX_CODE, VAT_TAX_CODE } from "@/lib/tax/constants";

const SALES_TAX_SEED_DEFAULTS: Array<{ variant: TaxRateVariant; rate: string }> = [
  { variant: TaxRateVariant.REAL, rate: "0.02" },
  { variant: TaxRateVariant.SIMPLIFIED, rate: "0.05" },
  { variant: TaxRateVariant.NO_TAXPAYER_ID, rate: "0.10" },
];

const SEED_EFFECTIVE_FROM = new Date("1970-01-01T00:00:00.000Z");

/**
 * Idempotent: ensures VAT TaxType, a default rate schedule from legacy CompanySettings.vatRate,
 * and TaxRegimeTax links for regimes with vatApplies.
 */
export async function ensureTaxCatalogSynced(companySettings: {
  vatRate: Prisma.Decimal;
}) {
  const prisma = getPrismaClient();

  const vatType = await prisma.taxType.upsert({
    where: { code: VAT_TAX_CODE },
    create: { code: VAT_TAX_CODE, name: "VAT", sortOrder: 0 },
    update: {},
  });

  await prisma.taxRateSchedule.upsert({
    where: {
      taxTypeId_effectiveFrom_variant: {
        taxTypeId: vatType.id,
        effectiveFrom: SEED_EFFECTIVE_FROM,
        variant: TaxRateVariant.DEFAULT,
      },
    },
    create: {
      taxTypeId: vatType.id,
      variant: TaxRateVariant.DEFAULT,
      rate: companySettings.vatRate,
      effectiveFrom: SEED_EFFECTIVE_FROM,
    },
    update: {},
  });

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

  await ensureSalesTaxCatalogSynced();
}

/**
 * Idempotent: ensures Sales Tax (SAT) type, default variant schedules, and regime links.
 */
export async function ensureSalesTaxCatalogSynced() {
  const prisma = getPrismaClient();

  const satType = await prisma.taxType.upsert({
    where: { code: SALES_TAX_CODE },
    create: { code: SALES_TAX_CODE, name: "Sales Tax", sortOrder: 10 },
    update: {},
  });

  for (const { variant, rate } of SALES_TAX_SEED_DEFAULTS) {
    await prisma.taxRateSchedule.upsert({
      where: {
        taxTypeId_effectiveFrom_variant: {
          taxTypeId: satType.id,
          effectiveFrom: SEED_EFFECTIVE_FROM,
          variant,
        },
      },
      create: {
        taxTypeId: satType.id,
        variant,
        rate,
        effectiveFrom: SEED_EFFECTIVE_FROM,
      },
      update: {},
    });
  }

  await syncSalesTaxRegimeLinks();
}

/** Link Sales Tax to every tax regime (sales tax rules apply per customer context). */
export async function syncSalesTaxRegimeLinks() {
  const prisma = getPrismaClient();
  const satType = await prisma.taxType.findUnique({
    where: { code: SALES_TAX_CODE },
    select: { id: true },
  });
  if (!satType) return;

  const regimes = await prisma.taxRegime.findMany({ select: { id: true } });
  for (const r of regimes) {
    await prisma.taxRegimeTax.upsert({
      where: {
        taxRegimeId_taxTypeId: { taxRegimeId: r.id, taxTypeId: satType.id },
      },
      create: { taxRegimeId: r.id, taxTypeId: satType.id },
      update: {},
    });
  }
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

/** Sets a Sales Tax rate row for a variant and effective calendar day. */
export async function upsertSalesTaxScheduleForVariant(
  variant: TaxRateVariant,
  rate: Prisma.Decimal,
  effectiveFrom: Date,
) {
  const prisma = getPrismaClient();

  let satType = await prisma.taxType.findUnique({ where: { code: SALES_TAX_CODE } });
  if (!satType) {
    satType = await prisma.taxType.create({
      data: { code: SALES_TAX_CODE, name: "Sales Tax", sortOrder: 10 },
    });
  }

  await prisma.taxRateSchedule.upsert({
    where: {
      taxTypeId_effectiveFrom_variant: {
        taxTypeId: satType.id,
        effectiveFrom,
        variant,
      },
    },
    create: {
      taxTypeId: satType.id,
      variant,
      rate,
      effectiveFrom,
    },
    update: { rate },
  });

  await syncSalesTaxRegimeLinks();
}
