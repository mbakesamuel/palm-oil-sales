import { Prisma } from "@prisma/client";
import type { CustomerTypeOption } from "@/lib/customer-types/types";
import {
  fmtKg,
  fmtXaf,
  type BudgetVsActualSlice,
  type CustomerTypeCell,
  type ProductSummaryBlock,
} from "./loader";
import { ProductBudgetVsActual } from "./ProductBudgetVsActual";

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
  customerTypeOptions: CustomerTypeOption[];
  compact?: boolean;
}) {
  const { block, customerTypeOptions, compact = false } = props;
  if (!cellHasData(block.total)) return null;

  const pad = compact ? "px-2 py-1" : "px-3 py-1.5";

  return (
    <section className="space-y-1 print:break-inside-avoid">
      <div className="rounded-t-md border border-b-0 border-border bg-accent/35 px-3 py-1.5 text-sm font-semibold">
        {block.productName}
      </div>
      <div
        className={
          block.budgetVsActual
            ? "overflow-x-auto border border-border"
            : "overflow-x-auto rounded-b-md border border-border"
        }
      >
        <table className="w-full min-w-[32rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-foreground/[0.04] text-left">
              <th className={`${pad} w-28 font-medium`} />
              {customerTypeOptions.map((opt) => (
                <th key={opt.id} className={`${pad} font-medium text-right`}>
                  {opt.name}
                </th>
              ))}
              <th className={`${pad} font-medium text-right`}>Total</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border">
              <td className={`${pad} font-medium`}>quantity</td>
              {customerTypeOptions.map((opt) => (
                <td key={opt.id} className={`${pad} text-right tabular-nums`}>
                  {fmtQtyCell(block.byType[opt.id]?.qtyKg ?? z)}
                </td>
              ))}
              <td className={`${pad} text-right tabular-nums font-medium`}>
                {fmtQtyCell(block.total.qtyKg)}
              </td>
            </tr>
            <tr>
              <td className={`${pad} font-medium`}>revenue</td>
              {customerTypeOptions.map((opt) => (
                <td key={opt.id} className={`${pad} text-right tabular-nums`}>
                  {fmtRevCell(block.byType[opt.id]?.revenueNet ?? z)}
                </td>
              ))}
              <td className={`${pad} text-right tabular-nums font-medium`}>
                {fmtRevCell(block.total.revenueNet)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      {block.budgetVsActual ? (
        <ProductBudgetVsActual budgetVsActual={block.budgetVsActual} compact={compact} />
      ) : null}
    </section>
  );
}

export function GrandCustomerSummaryTable(props: {
  grandByType: Record<string, CustomerTypeCell>;
  grandTotal: CustomerTypeCell;
  customerTypeOptions: CustomerTypeOption[];
  grandBudgetVsActual?: BudgetVsActualSlice | null;
  title?: string;
}) {
  const {
    grandByType,
    grandTotal,
    customerTypeOptions,
    grandBudgetVsActual = null,
    title = "Grand total (all products)",
  } = props;
  if (grandTotal.qtyKg.eq(0) && grandTotal.revenueNet.eq(0)) return null;

  return (
    <section className="space-y-1 print:break-inside-avoid">
      <div className="rounded-t-md border border-b-0 border-border bg-foreground/[0.06] px-3 py-1.5 text-sm font-semibold">
        {title}
      </div>
      <div
        className={
          grandBudgetVsActual
            ? "overflow-x-auto border border-border"
            : "overflow-x-auto rounded-b-md border border-border"
        }
      >
        <table className="w-full min-w-[32rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-foreground/[0.04] text-left">
              <th className="px-3 py-1.5 w-28 font-medium" />
              {customerTypeOptions.map((opt) => (
                <th key={opt.id} className="px-3 py-1.5 font-medium text-right">
                  {opt.name}
                </th>
              ))}
              <th className="px-3 py-1.5 font-medium text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border">
              <td className="px-3 py-1.5 font-medium">quantity</td>
              {customerTypeOptions.map((opt) => (
                <td key={opt.id} className="px-3 py-1.5 text-right tabular-nums">
                  {fmtQtyCell(grandByType[opt.id]?.qtyKg ?? z)}
                </td>
              ))}
              <td className="px-3 py-1.5 text-right tabular-nums font-semibold">
                {fmtQtyCell(grandTotal.qtyKg)}
              </td>
            </tr>
            <tr>
              <td className="px-3 py-1.5 font-medium">revenue</td>
              {customerTypeOptions.map((opt) => (
                <td key={opt.id} className="px-3 py-1.5 text-right tabular-nums">
                  {fmtRevCell(grandByType[opt.id]?.revenueNet ?? z)}
                </td>
              ))}
              <td className="px-3 py-1.5 text-right tabular-nums font-semibold">
                {fmtRevCell(grandTotal.revenueNet)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      {grandBudgetVsActual ? (
        <ProductBudgetVsActual budgetVsActual={grandBudgetVsActual} />
      ) : null}
    </section>
  );
}
