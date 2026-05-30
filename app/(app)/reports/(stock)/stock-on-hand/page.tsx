import { redirect } from "next/navigation";
import * as React from "react";
import { OpenReportButton } from "@/components/OpenReportButton";
import { ReportHeader } from "@/components/ReportHeader";
import { getServerSession } from "@/lib/auth-server";
import { ReportSignatory } from "@/components/ReportSignatory";
import { fmtKgOnHand, loadStockOnHandReport } from "./loader";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function StockOnHandReportPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");

  const data = await loadStockOnHandReport(session);
  if ("type" in data) {
    return (
      <div className="space-y-6 max-w-xl">
        <ReportHeader
          companyName="Stock"
          title="Stock on hand (by sales point)"
        />
        <div className="rounded-lg border border-amber-600/40 bg-amber-600/5 px-4 py-3 text-sm text-amber-950 dark:text-amber-200">
          Your role is tied to a sales point, but none is assigned. Ask an
          administrator.
        </div>
      </div>
    );
  }

  const generated = new Date();

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="hidden print:block">
          <ReportHeader
            companyName={data.settings.companyName}
            department={data.settings.department ?? null}
            logoSrc={data.settings.logoUrl}
            title="Stock on hand (by sales point)"
          />
        </div>
        <div className="print:hidden text-2xl font-bold">Stock Situation</div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm opacity-80">
              {data.scopedToSalesPoint && data.assignedSalesPointName
                ? `Scoped to ${data.assignedSalesPointName}.`
                : "All sales points (consolidated)."}{" "}
              Quantities are kg-based products by storage location and product
              (sellable + unsellable).
            </p>
            <p className="mt-1 text-xs tabular-nums opacity-70">
              Generated{" "}
              {generated.toLocaleString("en-GB", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
              {" · "}Grand total{" "}
              <span className="font-medium tabular-nums">
                {fmtKgOnHand(data.grandTotalKg)}
              </span>{" "}
              kg
            </p>
          </div>
          <div>
            <OpenReportButton
              href="/reports/stock-on-hand/print"
              label="Print report"
              sameTab
            />
          </div>
        </div>
      </div>

      {data.sections.length === 0 ? (
        <p className="text-sm opacity-75">No stock on hand found in scope.</p>
      ) : (
        <div className="space-y-8">
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left bg-foreground/6">
                  <th className="px-3 py-2 font-medium">Storage location</th>
                  <th className="px-3 py-2 font-medium">Product</th>
                  <th className="px-3 py-2 font-medium text-right">
                    Quantity (kg)
                  </th>
                  <th className="px-3 py-2 font-medium">Remarks</th>
                </tr>
              </thead>
              <tbody>
                {data.sections.map((sp) => (
                  <React.Fragment key={sp.salesPointId}>
                    <tr className="border-b border-border bg-foreground/4">
                      <td className="px-3 py-2 font-semibold" colSpan={4}>
                        {sp.salesPointName}
                      </td>
                    </tr>
                    {sp.rows.map((r) => (
                      <tr
                        key={`${sp.salesPointId}:${r.storageLocationId}:${r.productId}`}
                        className="border-b border-border"
                      >
                        <td className="px-3 py-2">{r.storageLocationName}</td>
                        <td className="px-3 py-2">{r.productName}</td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {fmtKgOnHand(r.qtyKg)}
                        </td>
                        <td className="px-3 py-2">{r.remark}</td>
                      </tr>
                    ))}
                    <tr className="font-medium border-b border-border">
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
                <tr className="border-t-2 border-border font-medium">
                  <td className="px-3 py-2 text-left" colSpan={2}>
                    Sellable total
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {fmtKgOnHand(data.grandSellableKg)}
                  </td>
                  <td className="px-3 py-2" />
                </tr>
                <tr className="border-b border-border font-medium">
                  <td className="px-3 py-2 text-left" colSpan={2}>
                    Unsellable total
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {fmtKgOnHand(data.grandUnsellableKg)}
                  </td>
                  <td className="px-3 py-2" />
                </tr>
                <tr className="border-b border-border font-semibold">
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

      <div className="hidden print:block">
        <ReportSignatory />
      </div>
    </div>
  );
}
