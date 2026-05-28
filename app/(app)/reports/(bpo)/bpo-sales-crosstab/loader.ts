import { Prisma, ValidationStatus } from "@prisma/client";
import { calendarMonthForFiscalMonth } from "@/lib/fiscal";
import { getPrismaClient } from "@/lib/prisma";
import { prismaRetry } from "@/lib/prisma-retry";
import { getOrInitCompanySettings } from "@/lib/settings";

export const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;
const z = new Prisma.Decimal(0);

export type CrosstabRow = {
  productId: number;
  label: string;
  monthlyUnits: Prisma.Decimal[];
  monthlyGross: Prisma.Decimal[];
};

export type BpoCrosstabData = {
  periods: Array<{
    financialYear: number;
    startDate: Date;
    endDate: Date;
  }>;
  selectedPeriod: {
    financialYear: number;
    startDate: Date;
    endDate: Date;
  } | null;
  rows: CrosstabRow[];
  settings: Awaited<ReturnType<typeof getOrInitCompanySettings>>;
};

function fiscalMonthBounds(
  financialYear: number,
  financialMonth: number,
  fiscalYearStartMonth: number,
) {
  const cal = calendarMonthForFiscalMonth(
    financialYear,
    financialMonth,
    fiscalYearStartMonth,
  );
  const start = new Date(Date.UTC(cal.year, cal.month - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(cal.year, cal.month, 0, 23, 59, 59, 999));
  return { start, end };
}

export async function loadBpoCrosstab(fyRaw: string | null | undefined): Promise<BpoCrosstabData> {
  const prisma = getPrismaClient();
  const [settings, periods, bottledProducts] = await Promise.all([
    getOrInitCompanySettings(),
    prismaRetry(() =>
      prisma.financialYearPeriod.findMany({
        orderBy: { financialYear: "desc" },
        select: { financialYear: true, startDate: true, endDate: true },
      }),
    ),
    prismaRetry(() =>
      prisma.product.findMany({
        where: { productCat: { isBottled: true } },
        orderBy: { productName: "asc" },
        select: { productId: true, productName: true },
      }),
    ),
  ]);

  const yParsed = Number.parseInt(String(fyRaw ?? ""), 10);
  const selectedPeriod =
    periods.find((p) => p.financialYear === yParsed) ?? periods[0] ?? null;

  if (!selectedPeriod) {
    return { periods, selectedPeriod: null, rows: [], settings };
  }

  const monthBounds = MONTHS.map((financialMonth) =>
    fiscalMonthBounds(
      selectedPeriod.financialYear,
      financialMonth,
      settings.fiscalYearStartMonth,
    ),
  );
  const reportStart = monthBounds[0]!.start;
  const reportEnd = monthBounds[monthBounds.length - 1]!.end;

  const saleLines = await prismaRetry(() =>
    prisma.saleLine.findMany({
      where: {
        product: { productCat: { isBottled: true } },
        sale: {
          status: ValidationStatus.VALIDATED,
          soldAt: { gte: reportStart, lte: reportEnd },
        },
      },
      select: {
        productId: true,
        qtyUnits: true,
        lineGross: true,
        sale: { select: { soldAt: true } },
      },
    }),
  );

  const rows: CrosstabRow[] = bottledProducts.map((product) => ({
    productId: product.productId,
    label: product.productName,
    monthlyUnits: MONTHS.map(() => z),
    monthlyGross: MONTHS.map(() => z),
  }));
  const rowByProduct = new Map(rows.map((row) => [row.productId, row]));

  for (const line of saleLines) {
    const row = rowByProduct.get(line.productId);
    if (!row) continue;
    const soldAt = line.sale.soldAt;
    const monthIndex = monthBounds.findIndex(
      (bounds) => soldAt >= bounds.start && soldAt <= bounds.end,
    );
    if (monthIndex < 0) continue;
    row.monthlyUnits[monthIndex] = row.monthlyUnits[monthIndex]!.add(
      line.qtyUnits ?? z,
    );
    row.monthlyGross[monthIndex] = row.monthlyGross[monthIndex]!.add(
      line.lineGross,
    );
  }

  return { periods, selectedPeriod, rows, settings };
}
