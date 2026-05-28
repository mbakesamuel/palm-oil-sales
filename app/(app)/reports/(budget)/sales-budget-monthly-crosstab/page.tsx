import Link from "next/link";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { OpenReportButton } from "@/components/OpenReportButton";
import { ReportHeader } from "@/components/ReportHeader";
import { monthName } from "@/lib/fiscal";
import { getServerSession } from "@/lib/auth-server";
import {
  CAL_MONTHS,
  fmtMonthlyKg,
  loadMonthlyBudgetCrosstab,
} from "./loader";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const z = new Prisma.Decimal(0);

export default async function SalesBudgetMonthlyCrosstabPage({
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
    yearChoices,
    reportYear,
    hasAnyBudget,
    productsInReportCount,
    rows,
    colTotals,
    grandTotal,
  } = data;

  const generated = new Date();

  return (
    <div className="space-y-6" data-print-page="sales-budget-monthly-crosstab">
      <div className="space-y-3">
        <ReportHeader
          companyName={settings.companyName}
          department={settings.department}
          logoSrc={settings.logoUrl}
          title="Sales budget — monthly phasing crosstab (kg)"
        />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm opacity-80">
              Calendar year{" "}
              <span className="font-medium tabular-nums">{reportYear}</span>.
              Rows are products; columns are January–December. Each cell is
              phased budget kg for the fiscal period that contains that calendar
              month (from{" "}
              <Link href="/setup/sales-budget" className="underline">
                Sales budgets
              </Link>
              ).{" "}
              <Link
                href="/reports/sales-budget-weekly-crosstab"
                className="underline"
              >
                Weekly phasing crosstab
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
          <div>
            <OpenReportButton
              href="/reports/sales-budget-monthly-crosstab/print"
              params={{ year: reportYear }}
              label="Print report"
            />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        {yearChoices.map((y) => (
          <Link
            key={y}
            href={`/reports/sales-budget-monthly-crosstab?year=${y}`}
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

      {!hasAnyBudget ? (
        <p className="text-sm opacity-75">
          No product sales budgets are defined yet. Use{" "}
          <Link href="/setup/sales-budget" className="underline">
            Sales budgets
          </Link>{" "}
          to add annual quantities.
        </p>
      ) : productsInReportCount === 0 ? (
        <p className="text-sm opacity-75">
          Budget lines reference no matching products, or the catalog is empty.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left align-bottom">
                <th className="sticky left-0 z-10 bg-background px-3 py-2 font-medium">
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
                  <td className="sticky left-0 z-10 max-w-[min(24rem,50vw)] bg-background px-3 py-2 font-medium">
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
                <td className="sticky left-0 z-10 bg-background px-3 py-2">
                  Column totals (kg)
                </td>
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
    </div>
  );
}
