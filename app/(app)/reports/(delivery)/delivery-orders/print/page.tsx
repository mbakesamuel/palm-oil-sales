import { redirect } from "next/navigation";
import { AutoPrint } from "@/components/AutoPrint";
import { PrintButton } from "@/components/PrintButton";
import { ReportFooter } from "@/components/ReportFooter";
import { ReportHeader } from "@/components/ReportHeader";
import { getServerSession } from "@/lib/auth-server";
import {
  DELIVERY_ORDERS_REPORT_LIMIT,
  loadDeliveryOrdersReport,
  xafDeliveryOrders as xaf,
} from "../loader";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function DeliveryOrdersReportPrintPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");

  const result = await loadDeliveryOrdersReport(session);
  if ("type" in result) {
    return (
      <div className="space-y-4 max-w-xl">
        <div className="flex items-center justify-end print:hidden">
          <PrintButton label="Print" />
        </div>
        <ReportHeader
          companyName="" 
          title="Delivery orders"
        />
        <div className="rounded-lg border border-amber-600/40 bg-amber-600/5 px-4 py-3 text-sm text-amber-950 dark:text-amber-200">
          No sales point is assigned to your account; cannot print this report.
        </div>
        <ReportFooter signatory />
      </div>
    );
  }

  const {
    settings,
    scopedToSalesPoint,
    assignedSalesPointName,
    rows,
    totalLines,
    grand,
    summaryBySp,
    summaryGrandOrders,
    summaryGrandLines,
    summaryGrandTotal,
  } = result;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end print:hidden">
        <PrintButton label="Print" />
      </div>

      <ReportHeader
        companyName={settings.companyName}
        department={settings.department}
        logoSrc={settings.logoUrl}
        title="Delivery orders"
      />

      <div className="text-xs opacity-80 space-y-1">
        {scopedToSalesPoint ? (
          <>
            <p>
              Sales point: <span className="font-medium">{assignedSalesPointName}</span>
              {" — "}validated delivery orders only.
            </p>
          </>
        ) : (
          <p>Organization-wide report — all sales points.</p>
        )}
        <p>
          {rows.length} order{rows.length === 1 ? "" : "s"}
          {rows.length >= DELIVERY_ORDERS_REPORT_LIMIT
            ? ` (latest ${DELIVERY_ORDERS_REPORT_LIMIT})`
            : ""}
        </p>
      </div>

      {!scopedToSalesPoint && summaryBySp.length > 0 ? (
        <section className="space-y-2 print:break-inside-avoid">
          <h2 className="text-lg font-semibold">Summary by sales point</h2>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-3 py-2 font-medium">Sales point</th>
                  <th className="px-3 py-2 font-medium text-right">Orders</th>
                  <th className="px-3 py-2 font-medium text-right">Lines</th>
                  <th className="px-3 py-2 font-medium text-right">
                    Total (XAF)
                  </th>
                </tr>
              </thead>
              <tbody>
                {summaryBySp.map((s) => (
                  <tr
                    key={s.salesPointId}
                    className="border-b border-border odd:bg-foreground/4"
                  >
                    <td className="px-3 py-2 font-medium">{s.salesPointName}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {s.orderCount}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {s.lineCount}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {xaf(s.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border font-medium">
                  <td className="px-3 py-2">Overall</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {summaryGrandOrders}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {summaryGrandLines}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {xaf(summaryGrandTotal)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      ) : null}

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">
          {scopedToSalesPoint
            ? "Validated orders for your sales point"
            : "Detail · all orders in scope"}
        </h2>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-3 py-2 font-medium">DO no.</th>
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">Customer</th>
                {!scopedToSalesPoint ? (
                  <th className="px-3 py-2 font-medium">Sales point</th>
                ) : null}
                <th className="px-3 py-2 font-medium text-right">Lines</th>
                <th className="px-3 py-2 font-medium text-right">
                  Total (XAF)
                </th>
                <th className="px-3 py-2 font-medium">FY / calendar</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-border odd:bg-foreground/4"
                >
                  <td className="px-3 py-2 font-mono text-xs font-medium">
                    {r.deliveryOrderNo}
                  </td>
                  <td className="px-3 py-2 tabular-nums whitespace-nowrap">
                    {r.dateIssued.toISOString().slice(0, 10)}
                  </td>
                  <td
                    className="px-3 py-2 max-w-[200px] truncate"
                    title={r.customer.name}
                  >
                    {r.customer.name}
                  </td>
                  {!scopedToSalesPoint ? (
                    <td
                      className="px-3 py-2 max-w-[140px] truncate"
                      title={r.salesPoint.name}
                    >
                      {r.salesPoint.name}
                    </td>
                  ) : null}
                  <td className="px-3 py-2 text-right tabular-nums">
                    {r.lineCount}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-medium">
                    {xaf(r.total)}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-xs opacity-80">
                    {r.financialYear != null &&
                    r.postingCalendarYear != null &&
                    r.financialMonth != null
                      ? `${r.financialYear} · ${r.postingCalendarYear}-${String(
                          r.financialMonth,
                        ).padStart(2, "0")}`
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
            {rows.length > 0 ? (
              <tfoot>
                <tr className="border-t-2 border-border font-medium">
                  <td
                    className="px-3 py-2"
                    colSpan={scopedToSalesPoint ? 3 : 4}
                  >
                    {scopedToSalesPoint
                      ? "Total (validated, this sales point)"
                      : "Grand total (this list)"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {totalLines}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {xaf(grand)}
                  </td>
                  <td className="px-3 py-2" />
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      </section>

      {rows.length === 0 ? (
        <p className="text-sm opacity-75">No delivery orders in scope.</p>
      ) : null}

      <ReportFooter signatory />
      <AutoPrint />
    </div>
  );
}
