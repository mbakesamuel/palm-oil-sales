import Link from "next/link";
import { redirect } from "next/navigation";
import * as React from "react";
import { AutoPrint } from "@/components/AutoPrint";
import { PrintButton } from "@/components/PrintButton";
import { ReportHeader } from "@/components/ReportHeader";
import { ReportSignatory } from "@/components/ReportSignatory";
import { getServerSession } from "@/lib/auth-server";
import { buildReportUrl } from "@/lib/build-report-url";
import { fmtKgOnHand, loadStockOnHandReport } from "../loader";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function StockOnHandPrintPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");

  const data = await loadStockOnHandReport(session);
  const backHref = buildReportUrl("/reports/stock-on-hand");

  if ("type" in data) {
    return (
      <div className="space-y-4 max-w-xl">
        <div className="print:hidden flex flex-wrap items-center justify-between gap-3">
          <Link
            href={backHref}
            className="text-sm underline underline-offset-4 opacity-80 hover:opacity-100"
          >
            ← Back to report
          </Link>
          <PrintButton label="Print" />
        </div>
        <ReportHeader companyName="Stock" title="Stock on hand (by sales point)" />
        <div className="rounded-lg border border-amber-600/40 bg-amber-600/5 px-4 py-3 text-sm text-amber-950 dark:text-amber-200">
          Your role is tied to a sales point, but none is assigned. Ask an
          administrator.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 w-full min-w-0 max-w-none">
      <div className="print:hidden flex flex-wrap items-center justify-between gap-3">
        <Link
          href={backHref}
          className="text-sm underline underline-offset-4 opacity-80 hover:opacity-100"
        >
          ← Back
        </Link>
        <PrintButton label="Print" />
      </div>

      <ReportHeader
        companyName={data.settings.companyName}
        department={data.settings.department ?? null}
        logoSrc={data.settings.logoUrl}
        title="Stock on hand (by sales point)"
      />

      <p className="text-xs opacity-80">
        {data.scopedToSalesPoint && data.assignedSalesPointName
          ? `Scoped to ${data.assignedSalesPointName}.`
          : "All sales points (consolidated)."}{" "}
        Grand total:{" "}
        <span className="font-medium tabular-nums">
          {fmtKgOnHand(data.grandTotalKg)}
        </span>{" "}
        kg
      </p>

      {data.sections.length === 0 ? (
        <p className="text-sm opacity-75">No stock on hand found in scope.</p>
      ) : (
        <div className="space-y-6">
          <div className="overflow-hidden rounded-lg border border-border print:border-black/25">
            <table className="w-full border-collapse text-sm print:text-black">
              <thead>
                <tr className="border-b border-border text-left bg-foreground/6 print:bg-transparent print:border-black/25">
                  <th className="px-3 py-2 font-medium">Storage location</th>
                  <th className="px-3 py-2 font-medium">Product</th>
                  <th className="px-3 py-2 font-medium text-right">Quantity (kg)</th>
                  <th className="px-3 py-2 font-medium">Remarks</th>
                </tr>
              </thead>
              <tbody>
                {data.sections.map((sp) => (
                  <React.Fragment key={sp.salesPointId}>
                    <tr className="border-b border-border bg-foreground/4 print:bg-transparent print:border-black/15">
                      <td className="px-3 py-2 font-semibold" colSpan={4}>
                        {sp.salesPointName}
                      </td>
                    </tr>
                    {sp.rows.map((r) => (
                      <tr
                        key={`${sp.salesPointId}:${r.storageLocationId}:${r.productId}`}
                        className="border-b border-border print:border-black/15"
                      >
                        <td className="px-3 py-2">{r.storageLocationName}</td>
                        <td className="px-3 py-2">{r.productName}</td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {fmtKgOnHand(r.qtyKg)}
                        </td>
                        <td className="px-3 py-2">{r.remark}</td>
                      </tr>
                    ))}
                    <tr className="font-medium border-b border-border print:border-black/30">
                      <td className="px-3 py-2 text-left" colSpan={2}>
                        Total
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {fmtKgOnHand(sp.totalKg)}
                      </td>
                      <td className="px-3 py-2" />
                    </tr>
                  </React.Fragment>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border font-medium print:border-black/30">
                  <td className="px-3 py-2 text-left" colSpan={2}>
                    Sellable total
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {fmtKgOnHand(data.grandSellableKg)}
                  </td>
                  <td className="px-3 py-2" />
                </tr>
                <tr className="border-b border-border font-medium print:border-black/25">
                  <td className="px-3 py-2 text-left" colSpan={2}>
                    Unsellable total
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {fmtKgOnHand(data.grandUnsellableKg)}
                  </td>
                  <td className="px-3 py-2" />
                </tr>
                <tr className="border-b border-border font-semibold print:border-black/25">
                  <td className="px-3 py-2 text-left" colSpan={2}>
                    Grand total
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {fmtKgOnHand(data.grandTotalKg)}
                  </td>
                  <td className="px-3 py-2" />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      <ReportSignatory />
      <AutoPrint closeOnFinish={false} />
    </div>
  );
}

