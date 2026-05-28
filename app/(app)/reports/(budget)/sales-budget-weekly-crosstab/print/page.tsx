import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { AutoPrint } from "@/components/AutoPrint";
import { PrintButton } from "@/components/PrintButton";
import { ReportFooter } from "@/components/ReportFooter";
import { ReportHeader } from "@/components/ReportHeader";
import { monthName } from "@/lib/fiscal";
import { getServerSession } from "@/lib/auth-server";
import {
  CAL_MONTHS,
  cellKey,
  fmtWeeklyKg,
  loadWeeklyBudgetCrosstab,
} from "../loader";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const z = new Prisma.Decimal(0);

export default async function SalesBudgetWeeklyCrosstabPrintPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const session = await getServerSession();
  if (!session) redirect("/login");

  const { year: yearRaw } = await searchParams;
  const data = await loadWeeklyBudgetCrosstab(yearRaw);
  const {
    settings,
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end print:hidden">
        <PrintButton label="Print" />
      </div>

      <ReportHeader
        companyName={settings.companyName}
        department={settings.department}
        logoSrc={settings.logoUrl}
        title="Sales budget — weekly phasing crosstab (kg)"
      />

      <p className="text-xs opacity-80">
        Calendar year{" "}
        <span className="font-medium tabular-nums">{reportYear}</span>. Rows are
        ISO weeks; columns are product × calendar month.
      </p>

      {!hasAnyBudget ? (
        <p className="text-sm opacity-75">No product sales budgets defined.</p>
      ) : productsInReport.length === 0 ? (
        <p className="text-sm opacity-75">
          Budget lines reference no matching products.
        </p>
      ) : sortedWeeks.length === 0 ? (
        <p className="text-sm opacity-75">
          No phased weeks fall in this calendar year for the loaded budgets.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="min-w-max text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-border text-left align-bottom">
                <th
                  rowSpan={2}
                  className="min-w-24 border-r border-border px-2 py-2 font-medium"
                >
                  ISO week
                </th>
                {productsInReport.map((p) => {
                  const code = p.productCode ? ` (${p.productCode})` : "";
                  return (
                    <th
                      key={p.productId}
                      colSpan={12}
                      className="border-b border-l border-border px-1 py-1 text-center font-medium"
                    >
                      <span className="whitespace-normal">{p.productName}</span>
                      {code ? <span className="opacity-80">{code}</span> : null}
                    </th>
                  );
                })}
                <th
                  rowSpan={2}
                  className="border-l border-border px-2 py-2 text-right font-medium"
                >
                  Row total
                </th>
              </tr>
              <tr className="border-b border-border">
                {productsInReport.map((p) =>
                  CAL_MONTHS.map((m) => (
                    <th
                      key={`${p.productId}-${m}`}
                      className="min-w-14 border-l border-border px-0.5 py-1 text-right font-medium tabular-nums"
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
                    <td className="whitespace-nowrap border-r border-border px-2 py-1 font-mono text-[11px] sm:text-xs">
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
                <td className="border-r border-border px-2 py-2">
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

      <ReportFooter signatory />
      <AutoPrint />
    </div>
  );
}
