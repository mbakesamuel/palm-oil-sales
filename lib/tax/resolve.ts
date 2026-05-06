import "server-only";

import { Prisma } from "@prisma/client";
import { getPrismaClient } from "@/lib/prisma";
import { prismaDateToIso } from "@/lib/posting-calendar";
import { VAT_TAX_CODE } from "@/lib/tax/constants";

export type ResolvedTax = {
  taxTypeId: string;
  code: string;
  label: string;
  rate: Prisma.Decimal;
};

export type PrismaForTax = ReturnType<typeof getPrismaClient>;

/**
 * Resolve applicable taxes for a regime on a transaction instant.
 * Rates come from TaxRateSchedule: latest row with effectiveFrom <= transaction calendar day (UTC).
 */
export async function resolveTaxesForRegime(
  prisma: PrismaForTax,
  taxRegimeId: string,
  soldAt: Date,
): Promise<{ ok: true; taxes: ResolvedTax[] } | { ok: false; error: string }> {
  const dayIso = prismaDateToIso(soldAt);
  const asOfStartUtc = new Date(`${dayIso}T00:00:00.000Z`);

  const links = await prisma.taxRegimeTax.findMany({
    where: { taxRegimeId },
    include: {
      taxType: { select: { id: true, code: true, name: true, sortOrder: true } },
    },
  });

  const ordered = [...links].sort((a, b) => {
    const so = a.taxType.sortOrder - b.taxType.sortOrder;
    if (so !== 0) return so;
    return a.taxType.code.localeCompare(b.taxType.code);
  });

  const taxes: ResolvedTax[] = [];
  for (const link of ordered) {
    const row = await prisma.taxRateSchedule.findFirst({
      where: {
        taxTypeId: link.taxType.id,
        variant: "DEFAULT",
        effectiveFrom: { lte: asOfStartUtc },
      },
      orderBy: { effectiveFrom: "desc" },
    });
    if (!row) {
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

/** Combined rates for delivery-order lines (VAT bucket vs other statutory taxes). */
export function combinedVatAndOtherRates(taxes: ResolvedTax[]): {
  vatRate: Prisma.Decimal;
  otherRate: Prisma.Decimal;
  otherLabel: string | null;
} {
  let vatRate = new Prisma.Decimal(0);
  let otherRate = new Prisma.Decimal(0);
  const labels: string[] = [];
  for (const t of taxes) {
    if (t.code === VAT_TAX_CODE) {
      vatRate = vatRate.add(t.rate);
    } else {
      otherRate = otherRate.add(t.rate);
      labels.push(t.label);
    }
  }
  return {
    vatRate,
    otherRate,
    otherLabel: labels.length > 0 ? labels.join(" + ") : null,
  };
}

export function legacyVatSnapshotFromResolved(taxes: ResolvedTax[]): {
  vatRateSnapshot: Prisma.Decimal;
} {
  const vatRows = taxes.filter((t) => t.code === VAT_TAX_CODE);
  if (vatRows.length === 1) {
    return { vatRateSnapshot: vatRows[0]!.rate };
  }
  return { vatRateSnapshot: new Prisma.Decimal(0) };
}
