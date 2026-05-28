import { Fragment } from "react";
import { Prisma } from "@prisma/client";
import { formatFiscalMonthCalendarLabel } from "@/lib/fiscal";
import { MONTHS, type CrosstabRow } from "./loader";

const z = new Prisma.Decimal(0);

export type Metric = "units" | "gross";

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

export function ReportCrosstabSection(props: {
  title: string;
  unitLabel: string;
  metric: Metric;
  rows: CrosstabRow[];
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
    <section className="space-y-3 print:break-inside-avoid">
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
                BPO product
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
                  key={row.productId}
                  className="border-b border-border odd:bg-foreground/4 print:border-black/10 print:odd:bg-transparent"
                >
                  <td className="sticky left-0 z-10 bg-background px-1 py-2 font-medium print:bg-white print:text-black">
                    {row.label}
                  </td>
                  {MONTHS.map((financialMonth, idx) => (
                    <Fragment key={`${row.productId}-${financialMonth}`}>
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
                  No bottled products are defined.
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
