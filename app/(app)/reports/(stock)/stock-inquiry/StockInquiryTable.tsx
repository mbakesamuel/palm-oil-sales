import * as React from "react";
import {
  conditionLabel,
  fmtStockQty,
  type StockInquiryRow,
  type StockInquirySection,
} from "./loader";

type StockInquiryTableProps = {
  scopedToSalesPoint: boolean;
  sections: StockInquirySection[];
  emptyMessage?: string;
  print?: boolean;
};

export function StockInquiryTable(props: StockInquiryTableProps) {
  const {
    scopedToSalesPoint,
    sections,
    emptyMessage = "No stock balances match the selected filters.",
    print = false,
  } = props;

  const showSalesPointSections =
    !scopedToSalesPoint && sections.some((s) => s.rows.length > 0);
  const hasRows = sections.some((s) => s.rows.length > 0);

  const tableClass = print
    ? "w-full border-collapse text-sm print:text-black"
    : "w-full border-collapse text-sm";
  const headRowClass = print
    ? "border-b border-border text-left bg-foreground/6 print:bg-transparent print:border-black/25"
    : "border-b border-border text-left bg-foreground/6";
  const bodyRowClass = print
    ? "border-b border-border print:border-black/15"
    : "border-b border-border";
  const sectionRowClass = print
    ? "border-b border-border bg-foreground/4 print:bg-transparent print:border-black/15"
    : "border-b border-border bg-foreground/4";
  const borderWrapClass = print
    ? "overflow-hidden rounded-lg border border-border print:border-black/25"
    : "overflow-hidden rounded-lg border border-border";

  return (
    <div className={borderWrapClass}>
      <table className={tableClass}>
        <thead>
          <tr className={headRowClass}>
            <th className="px-3 py-2 font-medium">Storage location</th>
            <th className="px-3 py-2 font-medium">Product</th>
            <th className="px-3 py-2 font-medium">Condition</th>
            <th className="px-3 py-2 font-medium text-right">Quantity</th>
          </tr>
        </thead>
        <tbody>
          {!hasRows ? (
            <tr className={bodyRowClass}>
              <td
                className="px-3 py-6 text-center text-sm opacity-60"
                colSpan={4}
              >
                {emptyMessage}
              </td>
            </tr>
          ) : showSalesPointSections ? (
            sections.map((sp) =>
              sp.rows.length > 0 ? (
                <React.Fragment key={sp.salesPointId}>
                  <tr className={sectionRowClass}>
                    <td className="px-3 py-2 font-semibold" colSpan={4}>
                      {sp.salesPointName}
                    </td>
                  </tr>
                  {sp.rows.map((r) => (
                    <StockInquiryDataRow
                      key={`${r.salesPointId}:${r.storageLocationId}:${r.productId}:${r.condition}`}
                      row={r}
                      rowClass={bodyRowClass}
                    />
                  ))}
                </React.Fragment>
              ) : null,
            )
          ) : (
            sections.flatMap((sp) =>
              sp.rows.map((r) => (
                <StockInquiryDataRow
                  key={`${r.salesPointId}:${r.storageLocationId}:${r.productId}:${r.condition}`}
                  row={r}
                  rowClass={bodyRowClass}
                />
              )),
            )
          )}
        </tbody>
      </table>
    </div>
  );
}

function StockInquiryDataRow(props: {
  row: StockInquiryRow;
  rowClass: string;
}) {
  const { row: r, rowClass } = props;
  return (
    <tr className={rowClass}>
      <td className="px-3 py-2">{r.storageLocationName}</td>
      <td className="px-3 py-2">{r.productName}</td>
      <td className="px-3 py-2">{conditionLabel(r.condition)}</td>
      <td className="px-3 py-2 text-right tabular-nums">
        {fmtStockQty(r.qty, r.uom)}
      </td>
    </tr>
  );
}
