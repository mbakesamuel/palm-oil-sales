import { Prisma } from "@prisma/client";
import { fmtKg, type DailyCrosstabColumn, type DailyCrosstabDayRow } from "./loader";

const z = new Prisma.Decimal(0);

function cellDisplay(qty: Prisma.Decimal): string {
  return qty.equals(z) ? "—" : fmtKg(qty);
}

export function DailySalesCrosstabTable(props: {
  columns: DailyCrosstabColumn[];
  rows: DailyCrosstabDayRow[];
  colTotals: Record<string, Prisma.Decimal>;
  grandTotal: Prisma.Decimal;
  compact?: boolean;
}) {
  const { columns, rows, colTotals, grandTotal, compact } = props;
  const cellClass = compact ? "px-2 py-0.5" : "px-2 py-1";
  const headClass = compact ? "px-2 py-1" : "px-2 py-1.5";

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="min-w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left">
            <th className={`${headClass} font-medium w-14`}>DAY</th>
            {columns.map((col) => (
              <th
                key={col.key}
                className={`${headClass} font-medium text-right whitespace-nowrap`}
              >
                {col.label}
              </th>
            ))}
            <th className={`${headClass} font-medium text-right w-24`}>TOTAL</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.day} className="border-b border-border">
              <td className={`${cellClass} tabular-nums font-medium`}>{row.day}</td>
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={`${cellClass} text-right tabular-nums whitespace-nowrap`}
                >
                  {cellDisplay(row.cells[col.key] ?? z)}
                </td>
              ))}
              <td className={`${cellClass} text-right tabular-nums font-medium whitespace-nowrap`}>
                {cellDisplay(row.total)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-border font-medium bg-foreground/[0.04]">
            <td className={cellClass}>Total</td>
            {columns.map((col) => (
              <td
                key={col.key}
                className={`${cellClass} text-right tabular-nums whitespace-nowrap`}
              >
                {cellDisplay(colTotals[col.key] ?? z)}
              </td>
            ))}
            <td className={`${cellClass} text-right tabular-nums whitespace-nowrap`}>
              {cellDisplay(grandTotal)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
