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
  fmtMonthlyKg,
  loadMonthlyBudgetCrosstab,
} from "../loader";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const z = new Prisma.Decimal(0);

export default async function SalesBudgetMonthlyCrosstabPrintPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const session = await getServerSession();
  if (!session) redirect("/login");

  const { year: yearRaw } = await searchParams;
  const data = await loadMonthlyBudgetCrosstab(yearRaw);
  const {
    settings,
    reportYear,
    hasAnyBudget,
    productsInReportCount,
    rows,
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
        title="Sales budget — monthly phasing crosstab (kg)"
      />

      <p className="text-xs opacity-80">
        Calendar year{" "}
        <span className="font-medium tabular-nums">{reportYear}</span>. Rows are
        products; columns are January–December. Each cell is phased budget kg
        for the fiscal period that contains that calendar month.
      </p>

      {!hasAnyBudget ? (
        <p className="text-sm opacity-75">No product sales budgets defined.</p>
      ) : productsInReportCount === 0 ? (
        <p className="text-sm opacity-75">
          Budget lines reference no matching products.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left align-bottom">
                <th className="px-3 py-2 font-medium">Product</th>
                {CAL_MONTHS.map((m) => (
                  <th
                    key={m}
                    className="px-2 py-2 text-right font-medium whitespace-nowrap tabular-nums"
                    title={monthName(m)}
                  >
                    {monthName(m).slice(0, 3)}
                  </th>
                ))}
                <th className="border-l border-border px-3 py-2 text-right font-medium tabular-nums">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.productId}
                  className="border-b border-border odd:bg-foreground/4"
                >
                  <td className="max-w-[min(24rem,50vw)] px-3 py-2 font-medium">
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
                        {isZero ? "—" : fmtMonthlyKg(kg)}
                      </td>
                    );
                  })}
                  <td className="border-l border-border px-3 py-2 text-right font-medium tabular-nums">
                    {r.rowTotal.eq(z) ? "—" : fmtMonthlyKg(r.rowTotal)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border font-medium">
                <td className="px-3 py-2">Column totals (kg)</td>
                {colTotals.map((c, idx) => (
                  <td key={idx} className="px-2 py-2 text-right tabular-nums">
                    {c.eq(z) ? "—" : fmtMonthlyKg(c)}
                  </td>
                ))}
                <td className="border-l border-border px-3 py-2 text-right tabular-nums">
                  {grandTotal.eq(z) ? "—" : fmtMonthlyKg(grandTotal)}
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
