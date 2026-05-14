import Link from "next/link";
import { Fragment } from "react";
import { redirect } from "next/navigation";
import { Prisma, UserRole, ValidationStatus } from "@prisma/client";
import { PrintButton } from "@/components/PrintButton";
import { ReportHeader } from "@/components/ReportHeader";
import { ReportSignatory } from "@/components/ReportSignatory";
import { getServerSession } from "@/lib/auth-server";
import {
  calendarMonthForFiscalMonth,
  formatFinancialYearLabel,
  formatFiscalMonthCalendarLabel,
} from "@/lib/fiscal";
import { getPrismaClient } from "@/lib/prisma";
import { prismaRetry } from "@/lib/prisma-retry";
import { getOrInitCompanySettings } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const z = new Prisma.Decimal(0);
const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;
const bpoReportRoles = new Set<UserRole>([
  UserRole.ADMIN,
  UserRole.DIRECTOR,
  UserRole.MANAGER,
  UserRole.SENIOR_SUPERVISOR,
  UserRole.CLERK_IN_CHARGE_BPO,
]);

type Metric = "units" | "gross";

type RowData = {
  variantId: string;
  label: string;
  monthlyUnits: Prisma.Decimal[];
  monthlyGross: Prisma.Decimal[];
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

function fmtUnits(value: Prisma.Decimal) {
  return new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 3,
    minimumFractionDigits: 0,
  }).format(Number(value.toDecimalPlaces(3, Prisma.Decimal.ROUND_HALF_UP)));
}

function fmtXaf(value: Prisma.Decimal) {
  return new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(Number(value.toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP)));
}

function fmtCell(value: Prisma.Decimal, metric: Metric) {
  if (value.eq(z)) return "-";
  return metric === "units" ? fmtUnits(value) : fmtXaf(value);
}

function runningValues(values: Prisma.Decimal[]) {
  let running = z;
  return values.map((value) => {
    running = running.add(value);
    return running;
  });
}

function total(values: Prisma.Decimal[]) {
  return values.reduce((acc, value) => acc.add(value), z);
}

function ReportCrosstabSection(props: {
  title: string;
  unitLabel: string;
  metric: Metric;
  rows: RowData[];
  financialYear: number;
  fiscalYearStartMonth: number;
}) {
  const {
    title,
    unitLabel,
    metric,
    rows,
    financialYear,
    fiscalYearStartMonth,
  } = props;
  const monthlyTotals = MONTHS.map((_, idx) =>
    rows.reduce((acc, row) => {
      const values = metric === "units" ? row.monthlyUnits : row.monthlyGross;
      return acc.add(values[idx] ?? z);
    }, z),
  );
  const monthlyTotalsToDate = runningValues(monthlyTotals);
  const grandTotal = total(monthlyTotals);

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm opacity-75">{unitLabel}</p>
      </div>
      <div className="overflow-hidden rounded-lg border border-border print:border-black/20">
        <table className="w-full table-fixed border-collapse text-[9px] leading-tight print:text-black">
          <colgroup>
            <col className="w-[12%]" />
            {Array.from({ length: 26 }).map((_, idx) => (
              <col key={idx} style={{ width: `${88 / 26}%` }} />
            ))}
          </colgroup>
          <thead>
            <tr className="border-b border-border print:border-black/20">
              <th
                rowSpan={2}
                className="sticky left-0 z-20 bg-background px-1 py-2 text-left font-medium print:bg-white print:text-black"
              >
                BPO variant
              </th>
              {MONTHS.map((financialMonth) => (
                <th
                  key={financialMonth}
                  colSpan={2}
                  className="border-l border-border px-1 py-2 text-center font-medium"
                >
                  {formatFiscalMonthCalendarLabel(
                    financialYear,
                    financialMonth,
                    fiscalYearStartMonth,
                  )}
                </th>
              ))}
              <th
                colSpan={2}
                className="border-l border-border px-2 py-2 text-center font-medium"
              >
                Global total
              </th>
            </tr>
            <tr className="border-b border-border print:border-black/20">
              {MONTHS.map((financialMonth) => (
                <Fragment key={`heading-${financialMonth}`}>
                  <th className="border-l border-border px-1 py-1 text-right font-medium">
                    Month
                  </th>
                  <th className="px-1 py-1 text-right font-medium">To date</th>
                </Fragment>
              ))}
              <th className="border-l border-border px-1 py-1 text-right font-medium">
                Total
              </th>
              <th className="px-1 py-1 text-right font-medium">To date</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const values =
                metric === "units" ? row.monthlyUnits : row.monthlyGross;
              const toDate = runningValues(values);
              const rowTotal = total(values);
              return (
                <tr
                  key={row.variantId}
                  className="border-b border-border odd:bg-foreground/[0.04] print:border-black/10 print:odd:bg-transparent"
                >
                  <td className="sticky left-0 z-10 bg-background px-1 py-2 font-medium print:bg-white print:text-black">
                    {row.label}
                  </td>
                  {MONTHS.map((financialMonth, idx) => (
                    <Fragment key={`${row.variantId}-${financialMonth}`}>
                      <td className="border-l border-border px-1 py-2 text-right tabular-nums">
                        {fmtCell(values[idx] ?? z, metric)}
                      </td>
                      <td className="px-1 py-2 text-right tabular-nums">
                        {fmtCell(toDate[idx] ?? z, metric)}
                      </td>
                    </Fragment>
                  ))}
                  <td className="border-l border-border px-1 py-2 text-right font-medium tabular-nums">
                    {fmtCell(rowTotal, metric)}
                  </td>
                  <td className="px-1 py-2 text-right font-medium tabular-nums">
                    {fmtCell(rowTotal, metric)}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={27} className="px-3 py-4 text-sm opacity-75">
                  No BPO variants are defined.
                </td>
              </tr>
            ) : null}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border font-medium print:border-black/30">
              <td className="sticky left-0 z-10 bg-background px-1 py-2 print:bg-white print:text-black">
                Total
              </td>
              {MONTHS.map((financialMonth, idx) => (
                <Fragment key={`total-${financialMonth}`}>
                  <td className="border-l border-border px-1 py-2 text-right tabular-nums">
                    {fmtCell(monthlyTotals[idx] ?? z, metric)}
                  </td>
                  <td className="px-1 py-2 text-right tabular-nums">
                    {fmtCell(monthlyTotalsToDate[idx] ?? z, metric)}
                  </td>
                </Fragment>
              ))}
              <td className="border-l border-border px-1 py-2 text-right tabular-nums">
                {fmtCell(grandTotal, metric)}
              </td>
              <td className="px-1 py-2 text-right tabular-nums">
                {fmtCell(grandTotal, metric)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}

export default async function BpoSalesCrosstabReportPage(props: {
  searchParams: Promise<{ fy?: string }>;
}) {
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!bpoReportRoles.has(session.role as UserRole)) redirect("/forbidden");

  const [{ fy: fyRaw }, settings, periods, variants] = await Promise.all([
    props.searchParams,
    getOrInitCompanySettings(),
    prismaRetry(() =>
      getPrismaClient().financialYearPeriod.findMany({
        orderBy: { financialYear: "desc" },
        select: { financialYear: true, startDate: true, endDate: true },
      }),
    ),
    prismaRetry(() =>
      getPrismaClient().productVariant.findMany({
        where: { isActive: true, product: { isBottledPalmOil: true } },
        orderBy: [{ product: { productName: "asc" } }, { name: "asc" }],
        select: {
          id: true,
          name: true,
          product: { select: { productName: true } },
        },
      }),
    ),
  ]);

  const yParsed = Number.parseInt(String(fyRaw ?? ""), 10);
  const selectedPeriod =
    periods.find((p) => p.financialYear === yParsed) ?? periods[0] ?? null;
  if (!selectedPeriod) {
    return (
      <div className="space-y-6">
        <ReportHeader
          companyName={settings.companyName}
          department={settings.department}
          logoSrc={settings.logoUrl}
          title="BPO sales crosstab"
        />
        <p className="text-sm opacity-75">
          No financial year exists. Create a financial year before running this
          report.
        </p>
      </div>
    );
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
  const prisma = getPrismaClient();

  const saleLines = await prismaRetry(() =>
    prisma.saleLine.findMany({
      where: {
        product: { isBottledPalmOil: true },
        sale: {
          status: ValidationStatus.VALIDATED,
          soldAt: { gte: reportStart, lte: reportEnd },
        },
      },
      select: {
        productVariantId: true,
        qtyUnits: true,
        lineGross: true,
        sale: { select: { soldAt: true } },
      },
    }),
  );

  const rows: RowData[] = variants.map((variant) => ({
    variantId: variant.id,
    label: `${variant.product.productName} - ${variant.name}`,
    monthlyUnits: MONTHS.map(() => z),
    monthlyGross: MONTHS.map(() => z),
  }));
  const rowByVariant = new Map(rows.map((row) => [row.variantId, row]));

  for (const line of saleLines) {
    if (!line.productVariantId) continue;
    const row = rowByVariant.get(line.productVariantId);
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

  const generated = new Date();
  const fyLabel = formatFinancialYearLabel(
    selectedPeriod.financialYear,
    settings.fiscalYearStartMonth,
  );

  return (
    <div
      data-print-page="bpo-sales-crosstab"
      className="space-y-6 print:bg-white print:text-black"
    >
      <div className="space-y-3 print:block">
        <div className="hidden print:block">
        <ReportHeader
          companyName={settings.companyName}
          department={settings.department}
          logoSrc={settings.logoUrl}
          title="MonthlyBottled Palm Oil Sales Report"
        />
        </div>
       
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm opacity-80">
              Financial year <span className="font-medium">{fyLabel}</span>.
              Values are validated Bottled Palm Oil sales by variant.
            </p>
            <p className="mt-1 text-xs tabular-nums opacity-70">
              Generated{" "}
              {generated.toLocaleString("en-GB", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </p>
          </div>
          <div className="print:hidden">
            <PrintButton label="Print" />
          </div>
        </div>
      </div>

      <div className="print:hidden flex flex-wrap gap-2 text-sm">
        {periods.map((period) => (
          <Link
            key={period.financialYear}
            href={`/reports/bpo-sales-crosstab?fy=${period.financialYear}`}
            className={[
              "rounded-md border px-2 py-1 tabular-nums",
              period.financialYear === selectedPeriod.financialYear
                ? "border-foreground/25 bg-accent/35"
                : "border-border hover:bg-accent/25",
            ].join(" ")}
          >
            {formatFinancialYearLabel(
              period.financialYear,
              settings.fiscalYearStartMonth,
            )}
          </Link>
        ))}
      </div>

      <ReportCrosstabSection
        title="Quantity units"
        unitLabel="Month and financial-year-to-date units sold."
        metric="units"
        rows={rows}
        financialYear={selectedPeriod.financialYear}
        fiscalYearStartMonth={settings.fiscalYearStartMonth}
      />

      <ReportCrosstabSection
        title="Gross sales amount"
        unitLabel="Month and financial-year-to-date gross sales in XAF."
        metric="gross"
        rows={rows}
        financialYear={selectedPeriod.financialYear}
        fiscalYearStartMonth={settings.fiscalYearStartMonth}
      />

      <div className="hidden print:block">
        <ReportSignatory />
      </div>
    </div>
  );
}
