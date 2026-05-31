import {
  fmtKgQty,
  type StockVsCommitmentsCustomerSummary,
  type StockVsCommitmentsLocationSummary,
} from "./loader";

type StockVsCommitmentsDetailTablesProps = {
  scopedToSalesPoint: boolean;
  showSalesPointColumn: boolean;
  stockByLocation: StockVsCommitmentsLocationSummary[];
  commitmentByCustomer: StockVsCommitmentsCustomerSummary[];
  print?: boolean;
};

export function StockVsCommitmentsDetailTables(
  props: StockVsCommitmentsDetailTablesProps,
) {
  const {
    scopedToSalesPoint,
    showSalesPointColumn,
    stockByLocation,
    commitmentByCustomer,
    print = false,
  } = props;

  const tableClass = print
    ? "w-full border-collapse text-sm print:text-black"
    : "w-full border-collapse text-sm";
  const headRowClass = print
    ? "border-b border-border text-left bg-foreground/6 print:bg-transparent print:border-black/25"
    : "border-b border-border text-left bg-foreground/6";
  const bodyRowClass = print
    ? "border-b border-border print:border-black/15"
    : "border-b border-border";
  const borderWrapClass = print
    ? "overflow-hidden rounded-lg border border-border print:border-black/25"
    : "overflow-hidden rounded-lg border border-border";

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="space-y-2">
        <h2
          className={[
            "text-[10px] font-semibold uppercase tracking-wider",
            print ? "text-foreground/80" : "text-brand",
          ].join(" ")}
        >
          Stock by storage location
        </h2>
        <div className={borderWrapClass}>
          <table className={tableClass}>
            <thead>
              <tr className={headRowClass}>
                {showSalesPointColumn ? (
                  <th className="px-3 py-2 font-medium">Sales point</th>
                ) : null}
                <th className="px-3 py-2 font-medium">Storage location</th>
                <th className="px-3 py-2 font-medium text-right">Quantity</th>
              </tr>
            </thead>
            <tbody>
              {stockByLocation.length === 0 ? (
                <tr className={bodyRowClass}>
                  <td
                    className="px-3 py-6 text-center text-sm opacity-60"
                    colSpan={showSalesPointColumn ? 3 : 2}
                  >
                    No stock balances match the selected filters.
                  </td>
                </tr>
              ) : (
                stockByLocation.map((row) => (
                  <tr
                    key={`${row.salesPointId}:${row.storageLocationId}`}
                    className={bodyRowClass}
                  >
                    {showSalesPointColumn ? (
                      <td className="px-3 py-2">{row.salesPointName}</td>
                    ) : null}
                    <td className="px-3 py-2">{row.storageLocationName}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {fmtKgQty(row.qtyKg)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {!scopedToSalesPoint && stockByLocation.length > 0 ? (
          <p className="text-xs opacity-60">
            Aggregated across all storage locations before the summary comparison.
          </p>
        ) : null}
      </section>

      <section className="space-y-2">
        <h2
          className={[
            "text-[10px] font-semibold uppercase tracking-wider",
            print ? "text-foreground/80" : "text-brand",
          ].join(" ")}
        >
          Commitment by customer
        </h2>
        <div className={borderWrapClass}>
          <table className={tableClass}>
            <thead>
              <tr className={headRowClass}>
                {showSalesPointColumn ? (
                  <th className="px-3 py-2 font-medium">Sales point</th>
                ) : null}
                <th className="px-3 py-2 font-medium">Customer</th>
                <th className="px-3 py-2 font-medium text-right">Quantity</th>
              </tr>
            </thead>
            <tbody>
              {commitmentByCustomer.length === 0 ? (
                <tr className={bodyRowClass}>
                  <td
                    className="px-3 py-6 text-center text-sm opacity-60"
                    colSpan={showSalesPointColumn ? 3 : 2}
                  >
                    No outstanding commitments match the selected filters.
                  </td>
                </tr>
              ) : (
                commitmentByCustomer.map((row) => (
                  <tr
                    key={`${row.salesPointId}:${row.customerId}`}
                    className={bodyRowClass}
                  >
                    {showSalesPointColumn ? (
                      <td className="px-3 py-2">{row.salesPointName}</td>
                    ) : null}
                    <td className="px-3 py-2">{row.customerName}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {fmtKgQty(row.qtyKg)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {!scopedToSalesPoint && commitmentByCustomer.length > 0 ? (
          <p className="text-xs opacity-60">
            Aggregated across all customers before the summary comparison.
          </p>
        ) : null}
      </section>
    </div>
  );
}
