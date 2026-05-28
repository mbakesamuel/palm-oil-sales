import Link from "next/link";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { OpenReportButton } from "@/components/OpenReportButton";
import { monthName } from "@/lib/fiscal";
import { getServerSession } from "@/lib/auth-server";
import {
  CAL_MONTHS,
  cellKey,
  fmtWeeklyKg,
  loadWeeklyBudgetCrosstab,
} from "./loader";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const z = new Prisma.Decimal(0);

export default async function SalesBudgetWeeklyCrosstabPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const session = await getServerSession();
  if (!session) redirect("/login");

  const { year: yearRaw } = await searchParams;
  const data = await loadWeeklyBudgetCrosstab(yearRaw);
  const {
    yearChoices,
    reportYear,
    hasAnyBudget,
    productsInReport,
    sortedWeeks,
    cols,
    qtyByCell,
    rowTotals,
    colTotals,
    grandTotal,
  } = data;

  const generated = new Date();

  return (
    <div className="space-y-6" data-print-page="sales-budget-weekly-crosstab">
      <div className="space-y-3">
        <div className="flex flex-row justify-between items-center">
          <div className="flex flex-wrap gap-2 text-sm">
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

          <div>
            <OpenReportButton
              href="/reports/sales-budget-weekly-crosstab/print"
              params={{ year: reportYear }}
              label="Print report"
            />
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
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="min-w-max text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-border text-left align-bottom">
                <th
                  rowSpan={2}
                  className="sticky left-0 z-20 min-w-24 border-r border-border bg-background px-2 py-2 font-medium"
                >
                  ISO week
                </th>
                {productsInReport.map((p) => {
                  const code = p.productCode ? ` (${p.productCode})` : "";
                  return (
                    <th
                      key={p.productId}
                      colSpan={12}
                      className="border-b border-l border-border bg-accent/20 px-1 py-1 text-center font-medium"
                    >
                      <span className="whitespace-normal">{p.productName}</span>
                      {code ? <span className="opacity-80">{code}</span> : null}
                    </th>
                  );
                })}
                <th
                  rowSpan={2}
                  className="border-l border-border bg-background px-2 py-2 text-right font-medium"
                >
                  Row total
                </th>
              </tr>
              <tr className="border-b border-border">
                {productsInReport.map((p) =>
                  CAL_MONTHS.map((m) => (
                    <th
                      key={`${p.productId}-${m}`}
                      className="min-w-14 border-l border-border bg-accent/10 px-0.5 py-1 text-right font-medium tabular-nums"
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
                    className="border-b border-border odd:bg-foreground/4"
                  >
                    <td className="sticky left-0 z-10 whitespace-nowrap border-r border-border bg-background px-2 py-1 font-mono text-[11px] sm:text-xs">
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
                            "border-l border-border px-0.5 py-1 text-right tabular-nums",
                            isZero ? "opacity-40" : "",
                          ].join(" ")}
                        >
                          {isZero ? "—" : fmtWeeklyKg(q)}
                        </td>
                      );
                    })}
                    <td className="border-l border-border px-2 py-1 text-right font-medium tabular-nums">
                      {rt.eq(z) ? "—" : fmtWeeklyKg(rt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border font-medium">
                <td className="sticky left-0 z-10 border-r border-border bg-background px-2 py-2">
                  Column totals (kg)
                </td>
                {colTotals.map((c, idx) => (
                  <td
                    key={idx}
                    className="border-l border-border px-0.5 py-2 text-right tabular-nums"
                  >
                    {c.eq(z) ? "—" : fmtWeeklyKg(c)}
                  </td>
                ))}
                <td className="border-l border-border px-2 py-2 text-right tabular-nums">
                  {grandTotal.eq(z) ? "—" : fmtWeeklyKg(grandTotal)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
