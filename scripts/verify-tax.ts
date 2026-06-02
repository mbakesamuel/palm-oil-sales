import "dotenv/config";

import { PrismaClient, TaxRateVariant, TaxRegimeKind } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { SALES_TAX_CODE, VAT_TAX_CODE } from "@/lib/tax/constants";
import { resolveTaxesForCustomer } from "@/lib/tax/resolve-customer";

function d(n: number) {
  return n.toString();
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

    const defaultLine = await prisma.commercialService.findFirst({
      where: { code: "default" },
      select: { id: true },
    });
    if (!defaultLine) {
      throw new Error('No commercial service with code "default". Run app setup first.');
    }

    async function ensureVerifyRegime(name: string, kind: TaxRegimeKind) {
      const existing = await prisma.taxRegime.findFirst({
        where: { name, commercialServiceId: null },
        select: { id: true },
      });
      if (existing) {
        return prisma.taxRegime.update({
          where: { id: existing.id },
          data: { kind, vatApplies: true },
        });
      }
      return prisma.taxRegime.create({
        data: { name, kind, vatApplies: true, commercialServiceId: null },
      });
    }

    const simplifiedRegime = await ensureVerifyRegime(
      "__tax_verify__SIMPLIFIED",
      TaxRegimeKind.SIMPLIFIED,
    );
    const realRegime = await ensureVerifyRegime("__tax_verify__REAL", TaxRegimeKind.REAL);

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
        commercialServiceId: defaultLine.id,
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
        commercialServiceId: defaultLine.id,
        name: "__tax_verify__Local_Real_Regime",
        customerType: "RETAIL",
        residency: "LOCAL",
        taxRegimeId: realRegime.id,
        hasTaxpayerId: true,
        taxpayerId: "TPN-456",
      },
      select: { id: true },
    });
    created.push({ model: "Customer", id: c2.id });

    const cNoRegime = await prisma.customer.create({
      data: {
        commercialServiceId: defaultLine.id,
        name: "__tax_verify__Local_No_Regime",
        customerType: "RETAIL",
        residency: "LOCAL",
        taxRegimeId: null,
        hasTaxpayerId: false,
        taxpayerId: null,
      },
      select: { id: true },
    });
    created.push({ model: "Customer", id: cNoRegime.id });

    const c3 = await prisma.customer.create({
      data: {
        commercialServiceId: defaultLine.id,
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
        name: "Local + Simplified regime (expect VAT 19.25% + Sales Tax 5%)",
        customerId: c1.id,
        expect: { VAT: "0.1925", [SALES_TAX_CODE]: "0.05" },
      },
      {
        name: "Local + Real regime (expect VAT 19.25% + Sales Tax 2%)",
        customerId: c2.id,
        expect: { VAT: "0.1925", [SALES_TAX_CODE]: "0.02" },
      },
      {
        name: "Local + no regime (expect VAT 19.25% + Sales Tax 10%)",
        customerId: cNoRegime.id,
        expect: { VAT: "0.1925", [SALES_TAX_CODE]: "0.1" },
      },
      {
        name: "Local + Industry (expect VAT 19.25% only; no Sales Tax)",
        customerId: c3.id,
        expect: { VAT: "0.1925" as const },
      },
    ];

    let failures = 0;
    for (const tc of cases) {
      const resolved = await resolveTaxesForCustomer(prisma, tc.customerId, soldAt);
      if (!resolved.ok) {
        failures++;
        console.log(`FAIL: ${tc.name}`);
        console.log(`  resolver error: ${resolved.error}`);
        continue;
      }
      const byCode = new Map(
        resolved.taxes.map((t) => [t.code, t.rate.toString()]),
      );
      const gotVat = byCode.get(VAT_TAX_CODE);
      const gotSales = byCode.get(SALES_TAX_CODE);

      const expVat = (tc.expect as Record<string, string>).VAT;
      const expSales = (tc.expect as Record<string, string>)[SALES_TAX_CODE];

      const okVat = expVat ? gotVat === expVat : gotVat == null;
      const okSales = expSales ? gotSales === expSales : gotSales == null;
      const ok = okVat && okSales;

      console.log(`${ok ? "PASS" : "FAIL"}: ${tc.name}`);
      console.log(`  got: VAT=${gotVat ?? "—"} ${SALES_TAX_CODE}=${gotSales ?? "—"}`);
      console.log(`  exp: VAT=${expVat ?? "—"} ${SALES_TAX_CODE}=${expSales ?? "—"}`);
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

