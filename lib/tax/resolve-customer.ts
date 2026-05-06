import "server-only";

import { Prisma, TaxRateVariant, TaxRegimeKind } from "@prisma/client";
import { getPrismaClient } from "@/lib/prisma";
import { prismaDateToIso } from "@/lib/posting-calendar";
import { SALES_TAX_CODE, VAT_TAX_CODE } from "@/lib/tax/constants";

export type CustomerResolvedTax = {
  taxTypeId: string;
  code: string;
  label: string;
  rate: Prisma.Decimal;
};

type PrismaForTax = ReturnType<typeof getPrismaClient>;

async function resolveRateRow(
  prisma: PrismaForTax,
  taxTypeId: string,
  soldAt: Date,
  variant: TaxRateVariant,
) {
  const dayIso = prismaDateToIso(soldAt);
  const asOfStartUtc = new Date(`${dayIso}T00:00:00.000Z`);
  return prisma.taxRateSchedule.findFirst({
    where: { taxTypeId, variant, effectiveFrom: { lte: asOfStartUtc } },
    orderBy: { effectiveFrom: "desc" },
  });
}

export async function resolveTaxesForCustomer(
  prisma: PrismaForTax,
  customerId: string,
  soldAt: Date,
): Promise<{ ok: true; taxes: CustomerResolvedTax[] } | { ok: false; error: string }> {
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
  if (!customer) return { ok: false, error: "Customer not found." };

  // Start with taxes linked to regime (keeps admin control of what taxes exist at all),
  // then apply the customer-specific business rules as filters/variants.
  const links = await prisma.taxRegimeTax.findMany({
    where: { taxRegimeId: customer.taxRegimeId },
    include: { taxType: { select: { id: true, code: true, name: true, sortOrder: true } } },
  });

  const ordered = [...links].sort((a, b) => {
    const so = a.taxType.sortOrder - b.taxType.sortOrder;
    if (so !== 0) return so;
    return a.taxType.code.localeCompare(b.taxType.code);
  });

  const taxes: CustomerResolvedTax[] = [];
  for (const link of ordered) {
    // Rule 1: VAT only for LOCAL
    if (link.taxType.code === VAT_TAX_CODE && customer.residency !== "LOCAL") {
      continue;
    }

    // Rule 2: Sales Tax only for LOCAL and not for INDUSTRY; pick variant.
    if (link.taxType.code === SALES_TAX_CODE) {
      if (customer.residency !== "LOCAL") continue;
      if (customer.customerType === "INDUSTRY") continue;

      const variant = !customer.hasTaxpayerId
        ? TaxRateVariant.NO_TAXPAYER_ID
        : customer.taxRegime.kind === TaxRegimeKind.REAL
          ? TaxRateVariant.REAL
          : TaxRateVariant.SIMPLIFIED;

      const row = await resolveRateRow(prisma, link.taxType.id, soldAt, variant);
      if (!row) {
        return {
          ok: false,
          error: `No Sales Tax rate scheduled for variant ${variant} on this date. Add a rate row in Tax types (code ${SALES_TAX_CODE}).`,
        };
      }

      taxes.push({
        taxTypeId: link.taxType.id,
        code: link.taxType.code,
        label: link.taxType.name,
        rate: row.rate,
      });
      continue;
    }

    // Default behavior: resolve DEFAULT variant.
    const row = await resolveRateRow(prisma, link.taxType.id, soldAt, TaxRateVariant.DEFAULT);
    if (!row) {
      const dayIso = prismaDateToIso(soldAt);
      return {
        ok: false,
        error: `No tax rate scheduled for "${link.taxType.name}" (${link.taxType.code}) on or before ${dayIso}. Add a rate with an effective date in Tax setup.`,
      };
    }
    taxes.push({
      taxTypeId: link.taxType.id,
      code: link.taxType.code,
      label: link.taxType.name,
      rate: row.rate,
    });
  }

  return { ok: true, taxes };
}

