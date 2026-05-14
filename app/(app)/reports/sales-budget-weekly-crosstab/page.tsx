import Link from "next/link";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { getPrismaClient } from "@/lib/prisma";
import { prismaRetry } from "@/lib/prisma-retry";
import { getOrInitCompanySettings } from "@/lib/settings";
import {
  getOrInitProductSalesBudgetMonthPhaseProfile,
  profileRowToPercentDecimals,
} from "@/lib/sales-budget-profile";
import {
  buildSalesBudgetPhase,
  formatPhasedQtyKgDisplay,
  type SalesBudgetPhaseResult,
} from "@/lib/sales-budget-phase";
import { fiscalPeriodForCalendarMonth, monthName } from "@/lib/fiscal";
import { prismaDateToIso } from "@/lib/posting-calendar";
import { PrintButton } from "@/components/PrintButton";
import { ReportHeader } from "@/components/ReportHeader";
import { ReportSignatory } from "@/components/ReportSignatory";
import { getServerSession } from "@/lib/auth-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const z = new Prisma.Decimal(0);

function fmtKg(d: Prisma.Decimal) {
  return formatPhasedQtyKgDisplay(d);
}

const CAL_MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

function cellKey(weekLabel: string, productId: number, month: number) {
  return `${weekLabel}|||${productId}:${month}`;
}

export default async function SalesBudgetWeeklyCrosstabPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const session = await getServerSession();
  if (!session) redirect("/login");

  const sp = await searchParams;
  const settings = await getOrInitCompanySettings();
  const prisma = getPrismaClient();

  const [periods, products, budgets] = await Promise.all([
    prismaRetry(() =>
      prisma.financialYearPeriod.findMany({
        orderBy: { financialYear: "desc" },
        select: { financialYear: true, startDate: true, endDate: true },
      }),
    ),
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
          budgetUnitPricePerKg: true,
        },
      }),
    ),
  ]);

  const periodsByFy = new Map(periods.map((p) => [p.financialYear, p]));

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

  const productsInReport = products.filter((p) =>
    productIdsWithBudget.has(p.productId),
  );

  const phasePctByProductFy = new Map<string, Prisma.Decimal[]>();
  const pairSeen = new Set<string>();
  const pairList: { productId: number; financialYear: number }[] = [];
  for (const p of productsInReport) {
    for (const m of CAL_MONTHS) {
      const { financialYear } = fiscalPeriodForCalendarMonth(
        reportYear,
        m,
        settings.fiscalYearStartMonth,
      );
      if (!budgetMap.has(`${p.productId}:${financialYear}`)) continue;
      const pk = `${p.productId}:${financialYear}`;
      if (pairSeen.has(pk)) continue;
      pairSeen.add(pk);
      pairList.push({ productId: p.productId, financialYear });
    }
  }
  await Promise.all(
    pairList.map(async ({ productId, financialYear }) => {
      const row = await getOrInitProductSalesBudgetMonthPhaseProfile(
        financialYear,
        productId,
      );
      phasePctByProductFy.set(
        `${productId}:${financialYear}`,
        profileRowToPercentDecimals(row),
      );
    }),
  );

  const phaseResultCache = new Map<string, SalesBudgetPhaseResult | null>();

  function getPhaseResult(
    productId: number,
    fy: number,
  ): SalesBudgetPhaseResult | null {
    const cacheKey = `${productId}:${fy}`;
    if (phaseResultCache.has(cacheKey)) {
      return phaseResultCache.get(cacheKey) ?? null;
    }
    const b = budgetMap.get(`${productId}:${fy}`);
    const period = periodsByFy.get(fy);
    const pcts = phasePctByProductFy.get(`${productId}:${fy}`);
    if (!b || !period || !pcts) {
      phaseResultCache.set(cacheKey, null);
      return null;
    }
    try {
      const r = buildSalesBudgetPhase({
        financialYear: fy,
        fiscalYearStartMonth: settings.fiscalYearStartMonth,
        fyStartIso: prismaDateToIso(period.startDate),
        fyEndIso: prismaDateToIso(period.endDate),
        annualQtyKg: b.annualQtyKg,
        budgetUnitPricePerKg: b.budgetUnitPricePerKg,
        fiscalMonthPercents: pcts,
      });
      phaseResultCache.set(cacheKey, r);
      return r;
    } catch {
      phaseResultCache.set(cacheKey, null);
      return null;
    }
  }

  type WeekMeta = { label: string; wy: number; wk: number };
  const weekDedup = new Map<string, WeekMeta>();
  const qtyByCell = new Map<string, Prisma.Decimal>();

  for (const p of productsInReport) {
    for (const m of CAL_MONTHS) {
      const { financialYear } = fiscalPeriodForCalendarMonth(
        reportYear,
        m,
        settings.fiscalYearStartMonth,
      );
      const phase = getPhaseResult(p.productId, financialYear);
      if (!phase) continue;
      const pm = phase.months.find(
        (x) => x.calendarYear === reportYear && x.calendarMonth === m,
      );
      if (!pm) continue;
      for (const w of pm.weeks) {
        const sortKey = `${String(w.isoWeekYear).padStart(4, "0")}-W${String(w.isoWeek).padStart(2, "0")}`;
        if (!weekDedup.has(sortKey)) {
          weekDedup.set(sortKey, {
            label: w.label,
            wy: w.isoWeekYear,
            wk: w.isoWeek,
          });
        }
        qtyByCell.set(
          cellKey(w.label, p.productId, m),
          new Prisma.Decimal(w.qtyKg),
        );
      }
    }
  }

  const sortedWeeks = [...weekDedup.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, meta]) => meta);

  const cols: { productId: number; month: number }[] = [];
  for (const p of productsInReport) {
    for (const m of CAL_MONTHS) {
      cols.push({ productId: p.productId, month: m });
    }
  }

  const rowTotals = sortedWeeks.map((wk) => {
    let t = z;
    for (const c of cols) {
      const q = qtyByCell.get(cellKey(wk.label, c.productId, c.month)) ?? z;
      t = t.add(q);
    }
    return t;
  });

  const colTotals = cols.map((c) => {
    let t = z;
    for (const wk of sortedWeeks) {
      const q = qtyByCell.get(cellKey(wk.label, c.productId, c.month)) ?? z;
      t = t.add(q);
    }
    return t;
  });

  const grandTotal = colTotals.reduce((s, c) => s.add(c), z);

  const generated = new Date();
  const hasAnyBudget = budgets.length > 0;

  return (
    <div
      className="space-y-6 print:bg-white print:text-black"
      data-print-page="sales-budget-weekly-crosstab"
    >
      <div className="space-y-3 print:block">
        <div className="hidden print:block">
          <ReportHeader
            companyName={settings.companyName}
            department={settings.department}
            logoSrc={settings.logoUrl}
            title="Sales budget — weekly phasing crosstab (kg)"
          />
        </div>

        <div className="flex flex-row justify-between items-center">
        <div className="print:hidden flex flex-wrap gap-2 text-sm">
          {yearChoices.map((y) => (
            <Link
              key={y}
              href={`/reports/sales-budget-weekly-crosstab?year=${y}`}
              className={[
                "rounded-md border px-2 py-1 tabular-nums",
                y === reportYear
                  ? "border-foreground/25 bg-accent/35"
                  : "border-border hover:bg-accent/25",
              ].join(" ")}
            >
              {y}
            </Link>
          ))}
        </div>

        <div className="print:hidden">
          <PrintButton label="Print" />
        </div>
      </div>
        
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm opacity-80">
              Calendar year{" "}
              <span className="font-medium tabular-nums">{reportYear}</span>.
              Rows are ISO weeks; columns are product × calendar month. Each
              cell is phased budget kg for days in that week within that month
              (from{" "}
              <Link href="/setup/sales-budget" className="underline">
                Sales budgets
              </Link>
              ). See also{" "}
              <Link
                href="/reports/sales-budget-monthly-crosstab"
                className="underline"
              >
                Monthly phasing crosstab
              </Link>
              .
            </p>
            <p className="mt-1 text-xs tabular-nums opacity-70">
              Generated{" "}
              {generated.toLocaleString("en-GB", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </p>
          </div>
        </div>
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
      ) : sortedWeeks.length === 0 ? (
        <p className="text-sm opacity-75">
          No phased weeks fall in this calendar year for the loaded budgets
          (check financial year boundaries and budgets).
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border print:break-inside-avoid print:border-black/20">
          <table className="min-w-max text-xs print:text-black sm:text-sm">
            <thead>
              <tr className="border-b border-border text-left align-bottom print:border-black/20">
                <th
                  rowSpan={2}
                  className="sticky left-0 z-20 min-w-24 border-r border-border bg-background px-2 py-2 font-medium print:bg-white print:text-black"
                >
                  ISO week
                </th>
                {productsInReport.map((p) => {
                  const code = p.productCode ? ` (${p.productCode})` : "";
                  return (
                    <th
                      key={p.productId}
                      colSpan={12}
                      className="border-b border-l border-border bg-accent/20 px-1 py-1 text-center font-medium print:border-black/20"
                    >
                      <span className="whitespace-normal">{p.productName}</span>
                      {code ? <span className="opacity-80">{code}</span> : null}
                    </th>
                  );
                })}
                <th
                  rowSpan={2}
                  className="border-l border-border bg-background px-2 py-2 text-right font-medium print:bg-white print:text-black"
                >
                  Row total
                </th>
              </tr>
              <tr className="border-b border-border print:border-black/20">
                {productsInReport.map((p) =>
                  CAL_MONTHS.map((m) => (
                    <th
                      key={`${p.productId}-${m}`}
                      className="min-w-14 border-l border-border bg-accent/10 px-0.5 py-1 text-right font-medium tabular-nums print:border-black/15"
                      title={monthName(m)}
                    >
                      {monthName(m).slice(0, 3)}
                    </th>
                  )),
                )}
              </tr>
            </thead>
            <tbody>
              {sortedWeeks.map((wk, rowIdx) => {
                const rt = rowTotals[rowIdx]!;
                return (
                  <tr
                    key={wk.label}
                    className="border-b border-border odd:bg-foreground/4 print:border-black/15 print:odd:bg-transparent"
                  >
                    <td className="sticky left-0 z-10 whitespace-nowrap border-r border-border bg-background px-2 py-1 font-mono text-[11px] print:bg-white print:text-black sm:text-xs">
                      {wk.label}
                    </td>
                    {cols.map((c) => {
                      const q =
                        qtyByCell.get(
                          cellKey(wk.label, c.productId, c.month),
                        ) ?? z;
                      const isZero = q.eq(z);
                      return (
                        <td
                          key={`${c.productId}-${c.month}`}
                          className={[
                            "border-l border-border px-0.5 py-1 text-right tabular-nums print:border-black/15",
                            isZero ? "opacity-40" : "",
                          ].join(" ")}
                        >
                          {isZero ? "—" : fmtKg(q)}
                        </td>
                      );
                    })}
                    <td className="border-l border-border px-2 py-1 text-right font-medium tabular-nums">
                      {rt.eq(z) ? "—" : fmtKg(rt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border font-medium print:border-black/30">
                <td className="sticky left-0 z-10 border-r border-border bg-background px-2 py-2 print:bg-white print:text-black">
                  Column totals (kg)
                </td>
                {colTotals.map((c, idx) => (
                  <td
                    key={idx}
                    className="border-l border-border px-0.5 py-2 text-right tabular-nums print:border-black/15"
                  >
                    {c.eq(z) ? "—" : fmtKg(c)}
                  </td>
                ))}
                <td className="border-l border-border px-2 py-2 text-right tabular-nums">
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
