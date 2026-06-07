import "dotenv/config";

import { PrismaClient, TaxRateVariant, TaxRegimeKind } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { SALES_TAX_CODE, VAT_TAX_CODE } from "@/lib/tax/constants";

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
      customerTypeDefinition: { select: { code: true } },
      hasTaxpayerId: true,
      taxRegimeId: true,
      taxRegime: { select: { kind: true } },
    },
  });
  if (!customer) return { ok: false as const, error: "Customer not found." };
  if (!customer.taxRegimeId || !customer.taxRegime) {
    return { ok: false as const, error: "Customer has no tax regime." };
  }

  const day = isoDate(soldAt);
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
      taxes.push({ code: link.taxType.code, variant: "DEFAULT", rate: row.rate.toString() });
      continue;
    }

    if (link.taxType.code === SALES_TAX_CODE) {
      if (customer.residency !== "LOCAL") continue;
      if (customer.customerTypeDefinition?.code === "INDUSTRY") continue;

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
    const order = await prisma.deliveryOrder.findFirst({
      orderBy: { id: "desc" },
      select: {
        id: true,
        deliveryOrderNo: true,
        dateIssued: true,
        customerId: true,
        customer: {
          select: {
            name: true,
            residency: true,
            customerTypeDefinition: { select: { code: true } },
            hasTaxpayerId: true,
            taxRegime: {
              select: {
                id: true,
                name: true,
                kind: true,
                taxTypeLinks: { select: { taxType: { select: { code: true, name: true } } } },
              },
            },
          },
        },
      },
    });

    if (!order) {
      console.log("No delivery order found.");
      return;
    }

    console.log("Latest delivery order:", {
      id: order.id,
      no: order.deliveryOrderNo,
      dateIssued: order.dateIssued.toISOString().slice(0, 10),
    });
    console.log("Customer:", {
      id: order.customerId,
      name: order.customer.name,
      residency: order.customer.residency,
      customerTypeCode: order.customer.customerTypeDefinition?.code,
      hasTaxpayerId: order.customer.hasTaxpayerId,
    });
    console.log(
      "Tax regime:",
      order.customer.taxRegime
        ? {
            id: order.customer.taxRegime.id,
            name: order.customer.taxRegime.name,
            kind: order.customer.taxRegime.kind,
            linkedTaxCodes: order.customer.taxRegime.taxTypeLinks.map(
              (l) => l.taxType.code,
            ),
          }
        : null,
    );

    const soldAt = new Date(
      `${order.dateIssued.toISOString().slice(0, 10)}T12:00:00.000Z`,
    );
    const resolved = await resolveTaxesForCustomerLikeApp(prisma, order.customerId, soldAt);
    console.log("Resolved taxes:", resolved);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

