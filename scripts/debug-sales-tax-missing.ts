import "dotenv/config";

import { PrismaClient, TaxRateVariant, TaxRegimeKind } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { SALES_TAX_CODE } from "@/lib/tax/constants";

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

async function resolveSalesAndVatForCustomerLikeApp(
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
  if (!customer.taxRegimeId || !customer.taxRegime) {
    return { ok: false as const, error: "Customer has no tax regime." };
  }

  const day = iso(soldAt);
  const asOfStartUtc = new Date(`${day}T00:00:00.000Z`);
  const taxRegimeKind = customer.taxRegime.kind;

  const links = await prisma.taxRegimeTax.findMany({
    where: { taxRegimeId: customer.taxRegimeId },
    include: { taxType: { select: { id: true, code: true, name: true, sortOrder: true } } },
  });

  const ordered = [...links].sort((a, b) => {
    const so = a.taxType.sortOrder - b.taxType.sortOrder;
    if (so !== 0) return so;
    return a.taxType.code.localeCompare(b.taxType.code);
  });

  const taxes: Array<{ code: string; variant: string; rate: string }> = [];

  for (const link of ordered) {
    if (link.taxType.code === "VAT") {
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
      taxes.push({ code: link.taxType.code, variant: "DEFAULT", rate: row.rate.toString() });
      continue;
    }

    if (link.taxType.code === SALES_TAX_CODE) {
      if (customer.residency !== "LOCAL") continue;
      if (customer.customerType === "INDUSTRY") continue;

      const variant = !customer.hasTaxpayerId
        ? TaxRateVariant.NO_TAXPAYER_ID
        : taxRegimeKind === TaxRegimeKind.REAL
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
      if (!row) {
        return {
          ok: false as const,
          error: `Missing SALES_TAX(${variant}) schedule on ${day}`,
        };
      }
      taxes.push({ code: link.taxType.code, variant, rate: row.rate.toString() });
      continue;
    }
  }

  return { ok: true as const, taxes };
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL missing");

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
    log: ["error"],
  });

  try {
    const doCount = await prisma.deliveryOrder.count();
    console.log("DeliveryOrder count:", doCount);

    const latest = await prisma.deliveryOrder.findFirst({
      orderBy: { id: "desc" },
      select: { id: true, deliveryOrderNo: true, dateIssued: true, customerId: true },
    });
    console.log("Latest DO:", latest);
    if (!latest) return;

    const customer = await prisma.customer.findUnique({
      where: { id: latest.customerId },
      select: {
        name: true,
        residency: true,
        customerType: true,
        hasTaxpayerId: true,
        taxRegime: {
          select: {
            id: true,
            name: true,
            kind: true,
            taxTypeLinks: { select: { taxType: { select: { id: true, code: true, name: true } } } },
          },
        },
      },
    });
    console.log("Customer:", customer);
    const linked =
      customer?.taxRegime?.taxTypeLinks.map((l) => l.taxType.code) ?? [];
    console.log("Linked tax codes:", linked);

    const salesTax = await prisma.taxType.findUnique({
      where: { code: SALES_TAX_CODE },
      select: { id: true, code: true, name: true },
    });
    console.log("SALES_TAX type:", salesTax);
    if (salesTax) {
      const schedules = await prisma.taxRateSchedule.findMany({
        where: { taxTypeId: salesTax.id },
        orderBy: [{ variant: "asc" }, { effectiveFrom: "desc" }],
        select: { variant: true, effectiveFrom: true, rate: true },
      });
      console.log(
        "SALES_TAX schedules:",
        schedules.map((r) => ({
          variant: r.variant,
          effectiveFrom: iso(r.effectiveFrom),
          rate: r.rate.toString(),
        })),
      );
      const needDate = new Date(`${iso(latest.dateIssued)}T00:00:00.000Z`);
      console.log(
        "Schedules on/before",
        iso(latest.dateIssued),
        schedules
          .filter((r) => r.effectiveFrom <= needDate)
          .map((r) => ({
            variant: r.variant,
            effectiveFrom: iso(r.effectiveFrom),
            rate: r.rate.toString(),
          })),
      );
    }

    const soldAt = new Date(`${iso(latest.dateIssued)}T12:00:00.000Z`);
    const resolved = await resolveSalesAndVatForCustomerLikeApp(
      prisma,
      latest.customerId,
      soldAt,
    );
    console.log("Resolved taxes:", resolved);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

