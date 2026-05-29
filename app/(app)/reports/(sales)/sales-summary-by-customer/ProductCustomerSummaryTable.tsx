import { CustomerType, Prisma } from "@prisma/client";
import {
  DAILY_SALES_CUSTOMER_TYPE_LABELS,
  DAILY_SALES_TYPE_ORDER,
  fmtKg,
  fmtXaf,
  type CustomerTypeCell,
  type ProductSummaryBlock,
} from "./loader";

const z = new Prisma.Decimal(0);

function fmtQtyCell(d: Prisma.Decimal) {
  return d.eq(0) ? "" : fmtKg(d);
}

function fmtRevCell(d: Prisma.Decimal) {
  return d.eq(0) ? "" : fmtXaf(d);
}

function cellHasData(c: CustomerTypeCell) {
  return !c.qtyKg.eq(0) || !c.revenueNet.eq(0);
}

export function ProductCustomerSummaryTable(props: {
  block: ProductSummaryBlock;
  compact?: boolean;
}) {
  const { block, compact = false } = props;
  if (!cellHasData(block.total)) return null;

  const pad = compact ? "px-2 py-1" : "px-3 py-1.5";

  return (
    <section className="space-y-1 print:break-inside-avoid">
      <div className="rounded-t-md border border-b-0 border-border bg-accent/35 px-3 py-1.5 text-sm font-semibold">
        {block.productName}
      </div>
      <div className="overflow-x-auto rounded-b-md border border-border">
        <table className="w-full min-w-[32rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-foreground/[0.04] text-left">
              <th className={`${pad} w-28 font-medium`} />
              {DAILY_SALES_TYPE_ORDER.map((t) => (
                <th key={t} className={`${pad} font-medium text-right`}>
                  {DAILY_SALES_CUSTOMER_TYPE_LABELS[t]}
                </th>
              ))}
              <th className={`${pad} font-medium text-right`}>Total</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border">
              <td className={`${pad} font-medium`}>quantity</td>
              {DAILY_SALES_TYPE_ORDER.map((t) => (
                <td key={t} className={`${pad} text-right tabular-nums`}>
                  {fmtQtyCell(block.byType[t].qtyKg)}
                </td>
              ))}
              <td className={`${pad} text-right tabular-nums font-medium`}>
                {fmtQtyCell(block.total.qtyKg)}
              </td>
            </tr>
            <tr>
              <td className={`${pad} font-medium`}>revenue</td>
              {DAILY_SALES_TYPE_ORDER.map((t) => (
                <td key={t} className={`${pad} text-right tabular-nums`}>
                  {fmtRevCell(block.byType[t].revenueNet)}
                </td>
              ))}
              <td className={`${pad} text-right tabular-nums font-medium`}>
                {fmtRevCell(block.total.revenueNet)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function GrandCustomerSummaryTable(props: {
  grandByType: Record<CustomerType, CustomerTypeCell>;
  grandTotal: CustomerTypeCell;
  title?: string;
}) {
  const { grandByType, grandTotal, title = "Grand total (all products)" } = props;
  if (grandTotal.qtyKg.eq(0) && grandTotal.revenueNet.eq(0)) return null;

  return (
    <section className="space-y-1 print:break-inside-avoid">
      <div className="rounded-t-md border border-b-0 border-border bg-foreground/[0.06] px-3 py-1.5 text-sm font-semibold">
        {title}
      </div>
      <div className="overflow-x-auto rounded-b-md border border-border">
        <table className="w-full min-w-[32rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-foreground/[0.04] text-left">
              <th className="px-3 py-1.5 w-28 font-medium" />
              {DAILY_SALES_TYPE_ORDER.map((t) => (
                <th key={t} className="px-3 py-1.5 font-medium text-right">
                  {DAILY_SALES_CUSTOMER_TYPE_LABELS[t]}
                </th>
              ))}
              <th className="px-3 py-1.5 font-medium text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border">
              <td className="px-3 py-1.5 font-medium">quantity</td>
              {DAILY_SALES_TYPE_ORDER.map((t) => (
                <td key={t} className="px-3 py-1.5 text-right tabular-nums">
                  {fmtQtyCell(grandByType[t].qtyKg)}
                </td>
              ))}
              <td className="px-3 py-1.5 text-right tabular-nums font-semibold">
                {fmtQtyCell(grandTotal.qtyKg)}
              </td>
            </tr>
            <tr>
              <td className="px-3 py-1.5 font-medium">revenue</td>
              {DAILY_SALES_TYPE_ORDER.map((t) => (
                <td key={t} className="px-3 py-1.5 text-right tabular-nums">
                  {fmtRevCell(grandByType[t].revenueNet)}
                </td>
              ))}
              <td className="px-3 py-1.5 text-right tabular-nums font-semibold">
                {fmtRevCell(grandTotal.revenueNet)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
