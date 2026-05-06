import "dotenv/config";

import { PrismaClient, TaxRateVariant, TaxRegimeKind } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { SALES_TAX_CODE, VAT_TAX_CODE } from "@/lib/tax/constants";

function d(n: number) {
  // Prisma accepts string/number; use string for exact decimals we care about.
  return n.toString();
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

async function resolveTaxesForCustomerLikeApp(
  prisma: PrismaClient,
  customerId: string,
  soldAt: Date,
) {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: {
      residency: true,
      customerType: true,
      hasTaxpayerId: true,
      taxRegimeId: true,
      taxRegime: { select: { kind: true } },
    },
  });
  if (!customer) return { ok: false as const, error: "Customer not found." };

  const day = isoDate(soldAt);
  const asOfStartUtc = new Date(`${day}T00:00:00.000Z`);

  const links = await prisma.taxRegimeTax.findMany({
    where: { taxRegimeId: customer.taxRegimeId },
    include: { taxType: { select: { id: true, code: true, name: true, sortOrder: true } } },
  });
  const ordered = [...links].sort((a, b) => {
    const so = a.taxType.sortOrder - b.taxType.sortOrder;
    if (so !== 0) return so;
    return a.taxType.code.localeCompare(b.taxType.code);
  });

  const taxes: Array<{ code: string; rate: string }> = [];

  for (const link of ordered) {
    if (link.taxType.code === VAT_TAX_CODE) {
      if (customer.residency !== "LOCAL") continue;
      const row = await prisma.taxRateSchedule.findFirst({
        where: {
          taxTypeId: link.taxType.id,
          variant: TaxRateVariant.DEFAULT,
          effectiveFrom: { lte: asOfStartUtc },
        },
        orderBy: { effectiveFrom: "desc" },
      });
      if (!row) return { ok: false as const, error: `Missing VAT schedule on ${day}` };
      taxes.push({ code: link.taxType.code, rate: row.rate.toString() });
      continue;
    }

    if (link.taxType.code === SALES_TAX_CODE) {
      if (customer.residency !== "LOCAL") continue;
      if (customer.customerType === "INDUSTRY") continue;

      const variant = !customer.hasTaxpayerId
        ? TaxRateVariant.NO_TAXPAYER_ID
        : customer.taxRegime.kind === TaxRegimeKind.REAL
          ? TaxRateVariant.REAL
          : TaxRateVariant.SIMPLIFIED;

      const row = await prisma.taxRateSchedule.findFirst({
        where: {
          taxTypeId: link.taxType.id,
          variant,
          effectiveFrom: { lte: asOfStartUtc },
        },
        orderBy: { effectiveFrom: "desc" },
      });
      if (!row) return { ok: false as const, error: `Missing SALES_TAX(${variant}) schedule on ${day}` };
      taxes.push({ code: link.taxType.code, rate: row.rate.toString() });
      continue;
    }
  }

  return { ok: true as const, taxes };
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is missing in environment.");
  }
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
    log: ["error"],
  });
  const created: Array<{ model: string; id: string }> = [];

  const effectiveFrom = new Date("1970-01-01T00:00:00.000Z");
  const soldAt = new Date("2026-05-06T12:00:00.000Z");

  try {
    // Ensure tax types exist
    const vatType = await prisma.taxType.upsert({
      where: { code: VAT_TAX_CODE },
      update: { name: "VAT", sortOrder: 0 },
      create: { code: VAT_TAX_CODE, name: "VAT", sortOrder: 0 },
    });
    const salesTaxType = await prisma.taxType.upsert({
      where: { code: SALES_TAX_CODE },
      update: { name: "Sales Tax", sortOrder: 10 },
      create: { code: SALES_TAX_CODE, name: "Sales Tax", sortOrder: 10 },
    });

    // Ensure schedules (idempotent via unique constraint)
    await prisma.taxRateSchedule.upsert({
      where: {
        taxTypeId_effectiveFrom_variant: {
          taxTypeId: vatType.id,
          effectiveFrom,
          variant: TaxRateVariant.DEFAULT,
        },
      },
      update: { rate: d(0.1925) },
      create: {
        taxTypeId: vatType.id,
        effectiveFrom,
        variant: TaxRateVariant.DEFAULT,
        rate: d(0.1925),
      },
    });

    await prisma.taxRateSchedule.upsert({
      where: {
        taxTypeId_effectiveFrom_variant: {
          taxTypeId: salesTaxType.id,
          effectiveFrom,
          variant: TaxRateVariant.SIMPLIFIED,
        },
      },
      update: { rate: d(0.05) },
      create: {
        taxTypeId: salesTaxType.id,
        effectiveFrom,
        variant: TaxRateVariant.SIMPLIFIED,
        rate: d(0.05),
      },
    });
    await prisma.taxRateSchedule.upsert({
      where: {
        taxTypeId_effectiveFrom_variant: {
          taxTypeId: salesTaxType.id,
          effectiveFrom,
          variant: TaxRateVariant.REAL,
        },
      },
      update: { rate: d(0.02) },
      create: {
        taxTypeId: salesTaxType.id,
        effectiveFrom,
        variant: TaxRateVariant.REAL,
        rate: d(0.02),
      },
    });
    await prisma.taxRateSchedule.upsert({
      where: {
        taxTypeId_effectiveFrom_variant: {
          taxTypeId: salesTaxType.id,
          effectiveFrom,
          variant: TaxRateVariant.NO_TAXPAYER_ID,
        },
      },
      update: { rate: d(0.1) },
      create: {
        taxTypeId: salesTaxType.id,
        effectiveFrom,
        variant: TaxRateVariant.NO_TAXPAYER_ID,
        rate: d(0.1),
      },
    });

    // Ensure regimes exist (by unique name)
    const simplifiedRegime = await prisma.taxRegime.upsert({
      where: { name: "__tax_verify__SIMPLIFIED" },
      update: { kind: TaxRegimeKind.SIMPLIFIED, vatApplies: true },
      create: { name: "__tax_verify__SIMPLIFIED", kind: TaxRegimeKind.SIMPLIFIED, vatApplies: true },
    });
    const realRegime = await prisma.taxRegime.upsert({
      where: { name: "__tax_verify__REAL" },
      update: { kind: TaxRegimeKind.REAL, vatApplies: true },
      create: { name: "__tax_verify__REAL", kind: TaxRegimeKind.REAL, vatApplies: true },
    });

    // Link both taxes to regimes (idempotent upsert on composite PK)
    for (const regime of [simplifiedRegime, realRegime]) {
      await prisma.taxRegimeTax.upsert({
        where: { taxRegimeId_taxTypeId: { taxRegimeId: regime.id, taxTypeId: vatType.id } },
        update: {},
        create: { taxRegimeId: regime.id, taxTypeId: vatType.id },
      });
      await prisma.taxRegimeTax.upsert({
        where: { taxRegimeId_taxTypeId: { taxRegimeId: regime.id, taxTypeId: salesTaxType.id } },
        update: {},
        create: { taxRegimeId: regime.id, taxTypeId: salesTaxType.id },
      });
    }

    // Create customers to validate resolver outcomes
    const c1 = await prisma.customer.create({
      data: {
        name: "__tax_verify__Local_Simplified_WithTPN",
        customerType: "RETAIL",
        residency: "LOCAL",
        taxRegimeId: simplifiedRegime.id,
        hasTaxpayerId: true,
        taxpayerId: "TPN-123",
      },
      select: { id: true },
    });
    created.push({ model: "Customer", id: c1.id });

    const c2 = await prisma.customer.create({
      data: {
        name: "__tax_verify__Local_Real_NoTPN",
        customerType: "RETAIL",
        residency: "LOCAL",
        taxRegimeId: realRegime.id,
        hasTaxpayerId: false,
        taxpayerId: null,
      },
      select: { id: true },
    });
    created.push({ model: "Customer", id: c2.id });

    const c3 = await prisma.customer.create({
      data: {
        name: "__tax_verify__Local_Industry",
        customerType: "INDUSTRY",
        residency: "LOCAL",
        taxRegimeId: simplifiedRegime.id,
        hasTaxpayerId: true,
        taxpayerId: "TPN-999",
      },
      select: { id: true },
    });
    created.push({ model: "Customer", id: c3.id });

    const cases = [
      {
        name: "Local + Simplified + hasTaxpayerId=true (expect VAT 19.25% + SalesTax 5%)",
        customerId: c1.id,
        expect: { VAT: "0.1925", SALES_TAX: "0.05" },
      },
      {
        name: "Local + Real + hasTaxpayerId=false (expect VAT 19.25% + SalesTax 10%)",
        customerId: c2.id,
        expect: { VAT: "0.1925", SALES_TAX: "0.1" },
      },
      {
        name: "Local + Industry (expect VAT 19.25% only; no SalesTax)",
        customerId: c3.id,
        expect: { VAT: "0.1925" as const },
      },
    ];

    let failures = 0;
    for (const tc of cases) {
      const resolved = await resolveTaxesForCustomerLikeApp(prisma, tc.customerId, soldAt);
      if (!resolved.ok) {
        failures++;
        console.log(`FAIL: ${tc.name}`);
        console.log(`  resolver error: ${resolved.error}`);
        continue;
      }
      const byCode = new Map(resolved.taxes.map((t) => [t.code, t.rate]));
      const gotVat = byCode.get(VAT_TAX_CODE);
      const gotSales = byCode.get(SALES_TAX_CODE);

      const expVat = (tc.expect as any).VAT as string | undefined;
      const expSales = (tc.expect as any).SALES_TAX as string | undefined;

      const okVat = expVat ? gotVat === expVat : gotVat == null;
      const okSales = expSales ? gotSales === expSales : gotSales == null;
      const ok = okVat && okSales;

      console.log(`${ok ? "PASS" : "FAIL"}: ${tc.name}`);
      console.log(`  got: VAT=${gotVat ?? "—"} SALES_TAX=${gotSales ?? "—"}`);
      console.log(`  exp: VAT=${expVat ?? "—"} SALES_TAX=${expSales ?? "—"}`);
      if (!ok) failures++;
    }

    if (failures > 0) {
      process.exitCode = 1;
    }
  } finally {
    // Cleanup only customers we created (leave tax catalog/regimes in place).
    for (const row of created) {
      if (row.model === "Customer") {
        await prisma.customer.delete({ where: { id: row.id } }).catch(() => {});
      }
    }
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

