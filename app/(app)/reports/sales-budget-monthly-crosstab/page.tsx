import Link from "next/link";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { getPrismaClient } from "@/lib/prisma";
import { prismaRetry } from "@/lib/prisma-retry";
import { getOrInitCompanySettings } from "@/lib/settings";
import { getOrInitSalesBudgetMonthPhaseProfile, profileRowToPercentDecimals } from "@/lib/sales-budget-profile";
import { computeMonthlyBudgetQtyKgByFiscalMonth } from "@/lib/sales-budget-phase";
import { fiscalPeriodForCalendarMonth, monthName } from "@/lib/fiscal";
import { prismaDateToIso } from "@/lib/posting-calendar";
import { PrintButton } from "@/components/PrintButton";
import { ReportSignatory } from "@/components/ReportSignatory";
import { getServerSession } from "@/lib/auth-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const z = new Prisma.Decimal(0);

function fmtKg(d: Prisma.Decimal) {
  const n = Number(d.toDecimalPlaces(3, Prisma.Decimal.ROUND_HALF_UP));
  return new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 3,
    minimumFractionDigits: 0,
  }).format(n);
}

const CAL_MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

export default async function SalesBudgetMonthlyCrosstabPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const session = await getServerSession();
  if (!session) redirect("/login");

  const sp = await searchParams;
  const settings = await getOrInitCompanySettings();
  const prisma = getPrismaClient();

  const [periods, profile, products, budgets] = await Promise.all([
    prismaRetry(() =>
      prisma.financialYearPeriod.findMany({
        orderBy: { financialYear: "desc" },
        select: { financialYear: true, startDate: true, endDate: true },
      }),
    ),
    getOrInitSalesBudgetMonthPhaseProfile(),
    prismaRetry(() =>
      prisma.product.findMany({
        orderBy: { productName: "asc" },
        select: { productId: true, productName: true, productCode: true },
      }),
    ),
    prismaRetry(() =>
      prisma.productSalesBudget.findMany({
        select: {
          financialYear: true,
          productId: true,
          annualQtyKg: true,
        },
      }),
    ),
  ]);

  const periodsByFy = new Map(periods.map((p) => [p.financialYear, p]));
  const pcts = profileRowToPercentDecimals(profile);

  const yearsSet = new Set<number>();
  const yNow = new Date().getUTCFullYear();
  yearsSet.add(yNow);
  for (const p of periods) {
    const sy = p.startDate.getUTCFullYear();
    const ey = p.endDate.getUTCFullYear();
    for (let y = sy; y <= ey; y++) yearsSet.add(y);
  }
  const yearChoices = [...yearsSet].sort((a, b) => b - a);

  const yearRaw = String(sp.year ?? "").trim();
  const yParsed = Number.parseInt(yearRaw, 10);
  const reportYear =
    Number.isFinite(yParsed) && yearChoices.includes(yParsed)
      ? yParsed
      : (yearChoices[0] ?? yNow);

  const budgetMap = new Map<string, (typeof budgets)[number]>();
  const productIdsWithBudget = new Set<number>();
  for (const b of budgets) {
    budgetMap.set(`${b.productId}:${b.financialYear}`, b);
    productIdsWithBudget.add(b.productId);
  }

  const productsInReport = products.filter((p) => productIdsWithBudget.has(p.productId));

  const monthlyCache = new Map<string, Prisma.Decimal[]>();

  function monthlyLine(productId: number, fy: number): Prisma.Decimal[] | null {
    const b = budgetMap.get(`${productId}:${fy}`);
    if (!b) return null;
    const period = periodsByFy.get(fy);
    if (!period) return null;
    const key = `${productId}:${fy}`;
    let line = monthlyCache.get(key);
    if (!line) {
      line = computeMonthlyBudgetQtyKgByFiscalMonth({
        financialYear: fy,
        fiscalYearStartMonth: settings.fiscalYearStartMonth,
        fyStartIso: prismaDateToIso(period.startDate),
        fyEndIso: prismaDateToIso(period.endDate),
        annualQtyKg: b.annualQtyKg,
        fiscalMonthPercents: pcts,
      });
      monthlyCache.set(key, line);
    }
    return line;
  }

  type RowData = {
    productId: number;
    label: string;
    cells: Prisma.Decimal[];
    rowTotal: Prisma.Decimal;
  };

  const rows: RowData[] = productsInReport.map((p) => {
    const cells: Prisma.Decimal[] = [];
    let rowTotal = z;
    for (const m of CAL_MONTHS) {
      const { financialYear, financialMonth } = fiscalPeriodForCalendarMonth(
        reportYear,
        m,
        settings.fiscalYearStartMonth,
      );
      const line = monthlyLine(p.productId, financialYear);
      const kg = line ? line[financialMonth - 1]! : z;
      cells.push(kg);
      rowTotal = rowTotal.add(kg);
    }
    const code = p.productCode ? ` (${p.productCode})` : "";
    return {
      productId: p.productId,
      label: `${p.productName}${code}`,
      cells,
      rowTotal,
    };
  });

  const colTotals = CAL_MONTHS.map((_, i) =>
    rows.reduce((s, r) => s.add(r.cells[i]!), z),
  );
  const grandTotal = colTotals.reduce((s, c) => s.add(c), z);

  const generated = new Date();
  const logoSrc =
    settings.logoUrl && settings.logoUrl.trim() !== ""
      ? settings.logoUrl.trim()
      : "/cdc-logo-svg.svg";

  const hasAnyBudget = budgets.length > 0;

  return (
    <div
      className="space-y-6 print:bg-white print:text-black"
      data-print-page="sales-budget-monthly-crosstab"
    >
      <div className="space-y-3 print:block">
        <div className="w-full">
          <div className="relative flex min-h-8 items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element -- settings may point to arbitrary http(s) URLs */}
            <img
              src={logoSrc}
              alt=""
              className="absolute left-0 top-1/2 h-8 max-h-8 w-auto max-w-[72px] -translate-y-1/2 object-contain"
            />
            <h1 className="w-full px-22 text-center text-2xl font-semibold leading-tight sm:px-24">
              {settings.companyName}
            </h1>
          </div>
          <p className="mt-1 text-center text-sm opacity-80">{settings.department}</p>
          <p className="mt-1 text-center text-sm opacity-80">
            Sales budget — monthly phasing crosstab (kg)
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm opacity-80">
              Calendar year <span className="font-medium tabular-nums">{reportYear}</span>. Rows are
              products; columns are January–December. Each cell is phased budget kg for the fiscal
              period that contains that calendar month (from{" "}
              <Link href="/setup/sales-budget" className="underline">
                Sales budgets
              </Link>
              ).
            </p>
            <p className="mt-1 text-xs tabular-nums opacity-70">
              Generated{" "}
              {generated.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
            </p>
          </div>
          <div className="print:hidden">
            <PrintButton label="Print" />
          </div>
        </div>
      </div>

      <div className="print:hidden flex flex-wrap gap-2 text-sm">
        {yearChoices.map((y) => (
          <Link
            key={y}
            href={`/reports/sales-budget-monthly-crosstab?year=${y}`}
            className={[
              "rounded-md border px-2 py-1 tabular-nums",
              y === reportYear
                ? "border-black/20 bg-black/5 dark:border-white/20 dark:bg-white/10"
                : "border-black/10 hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/5",
            ].join(" ")}
          >
            {y}
          </Link>
        ))}
      </div>

      {!hasAnyBudget ? (
        <p className="text-sm opacity-75">
          No product sales budgets are defined yet. Use{" "}
          <Link href="/setup/sales-budget" className="underline">
            Sales budgets
          </Link>{" "}
          to add annual quantities.
        </p>
      ) : productsInReport.length === 0 ? (
        <p className="text-sm opacity-75">
          Budget lines reference no matching products, or the catalog is empty.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-black/10 dark:border-white/10 print:break-inside-avoid print:border-black/20">
          <table className="min-w-full text-sm print:text-black">
            <thead>
              <tr className="border-b border-black/10 dark:border-white/10 text-left align-bottom print:border-black/20">
                <th className="sticky left-0 z-10 bg-white px-3 py-2 font-medium dark:bg-neutral-950 print:bg-white print:text-black">
                  Product
                </th>
                {CAL_MONTHS.map((m) => (
                  <th
                    key={m}
                    className="px-2 py-2 text-right font-medium whitespace-nowrap tabular-nums"
                    title={monthName(m)}
                  >
                    {monthName(m).slice(0, 3)}
                  </th>
                ))}
                <th className="border-l border-black/10 px-3 py-2 text-right font-medium tabular-nums dark:border-white/10">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.productId}
                  className="border-b border-black/5 dark:border-white/5 odd:bg-black/2 dark:odd:bg-white/2 print:border-black/15 print:odd:bg-transparent"
                >
                  <td className="sticky left-0 z-10 max-w-[min(24rem,50vw)] bg-white px-3 py-2 font-medium dark:bg-neutral-950 print:bg-white print:text-black">
                    <span className="whitespace-normal">{r.label}</span>
                  </td>
                  {r.cells.map((kg, idx) => {
                    const isZero = kg.eq(z);
                    return (
                      <td
                        key={idx}
                        className={[
                          "px-2 py-2 text-right tabular-nums",
                          isZero ? "opacity-40" : "",
                        ].join(" ")}
                      >
                        {isZero ? "—" : fmtKg(kg)}
                      </td>
                    );
                  })}
                  <td className="border-l border-black/10 px-3 py-2 text-right font-medium tabular-nums dark:border-white/10">
                    {r.rowTotal.eq(z) ? "—" : fmtKg(r.rowTotal)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-black/15 font-medium dark:border-white/15 print:border-black/30">
                <td className="sticky left-0 z-10 bg-white px-3 py-2 dark:bg-neutral-950 print:bg-white print:text-black">
                  Column totals (kg)
                </td>
                {colTotals.map((c, idx) => (
                  <td key={idx} className="px-2 py-2 text-right tabular-nums">
                    {c.eq(z) ? "—" : fmtKg(c)}
                  </td>
                ))}
                <td className="border-l border-black/10 px-3 py-2 text-right tabular-nums dark:border-white/10">
                  {grandTotal.eq(z) ? "—" : fmtKg(grandTotal)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <div className="hidden print:block">
        <ReportSignatory />
      </div>
    </div>
  );
}
