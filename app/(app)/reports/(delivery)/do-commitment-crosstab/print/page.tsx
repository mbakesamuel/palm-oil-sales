import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { AutoPrint } from "@/components/AutoPrint";
import { PrintButton } from "@/components/PrintButton";
import { ReportFooter } from "@/components/ReportFooter";
import { ReportHeader } from "@/components/ReportHeader";
import { getOrInitCompanySettings } from "@/lib/settings";
import { getServerSession } from "@/lib/auth-server";
import {
  fmtQtyCx,
  loadDoCommitmentCrosstab,
  type DoCommitmentCellKey,
} from "../loader";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const z = new Prisma.Decimal(0);

export default async function DoCommitmentCrosstabPrintPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");

  const result = await loadDoCommitmentCrosstab(session);
  if ("type" in result) {
    const settings = await getOrInitCompanySettings();
    return (
      <div className="space-y-4 max-w-xl">
        <div className="flex items-center justify-end print:hidden">
          <PrintButton label="Print" />
        </div>
        <ReportHeader
          companyName={settings.companyName}
          department={settings.department}
          logoSrc={settings.logoUrl}
          title="DO quantity commitments (crosstab)"
        />
        <p className="text-sm opacity-75">
          No sales point is assigned to your account; cannot print this report.
        </p>
        <ReportFooter signatory />
      </div>
    );
  }

  const {
    settings,
    scopedToSalesPoint,
    assignedSalesPointName,
    ordersCount,
    salesPoints,
    products,
    grandTotal,
  } = result;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end print:hidden">
        <PrintButton label="Print" />
      </div>
      <div className="hidden print:block">
        <ReportHeader
          companyName={settings.companyName}
          department={settings.department}
          logoSrc={settings.logoUrl}
          title="DO quantity commitments (crosstab)"
        />
      </div>
      <div className="print:hidden text-2xl font-bold">Commitments</div>
      <p className="text-xs opacity-80">
        {scopedToSalesPoint ? (
          <>
            Scoped to{" "}
            <span className="font-medium">{assignedSalesPointName}</span> —{" "}
          </>
        ) : null}
        {ordersCount} validated DO{ordersCount === 1 ? "" : "s"} in scope.
      </p>

      {ordersCount === 0 ? (
        <p className="text-sm opacity-75">
          No validated delivery orders in scope.
        </p>
      ) : products.length === 0 ? (
        <p className="text-sm opacity-75">
          No outstanding commitments found (all balances are 0).
        </p>
      ) : (
        <div className="space-y-6">
          {products.map((p) => (
            <section key={p.productId} className="space-y-2 print:break-inside-avoid">
              <h2 className="text-sm font-semibold">{p.productName}</h2>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left align-bottom">
                      <th className="px-3 py-2 font-medium">Customer</th>
                      {salesPoints.map((sp) => (
                        <th
                          key={sp.id}
                          className="px-3 py-2 text-right font-medium whitespace-nowrap"
                          title={sp.name}
                        >
                          {sp.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {p.customerIds.map((cid) => (
                      <tr
                        key={cid}
                        className="border-b border-border odd:bg-foreground/4"
                      >
                        <td className="max-w-[min(28rem,55vw)] px-3 py-2 font-medium">
                          <span className="whitespace-normal">
                            {p.customerNameById.get(cid) ?? cid}
                          </span>
                        </td>
                        {salesPoints.map((sp) => {
                          const v =
                            p.cellBalance.get(
                              `${cid}:${p.productId}:${sp.id}` as DoCommitmentCellKey,
                            ) ?? z;
                          const isZero = v.eq(z);
                          const neg = v.lt(z);
                          return (
                            <td
                              key={sp.id}
                              className={[
                                "px-3 py-2 text-right tabular-nums",
                                isZero ? "opacity-50" : "",
                                neg ? "text-red-700 dark:text-red-400" : "",
                              ].join(" ")}
                            >
                              {fmtQtyCx(v)}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-border font-medium">
                      <td className="px-3 py-2">Total {p.productName}</td>
                      {salesPoints.map((sp) => (
                        <td key={sp.id} className="px-3 py-2 text-right tabular-nums">
                          {fmtQtyCx(p.colTotals.get(sp.id) ?? z)}
                        </td>
                      ))}
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>
          ))}

          <div className="rounded-lg border border-border p-4 text-sm print:break-inside-avoid">
            <div className="flex items-center justify-between gap-4">
              <span className="font-medium">Grand total</span>
              <span className="tabular-nums font-semibold">
                {fmtQtyCx(grandTotal)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/*    <ReportFooter signatory /> */}
      <AutoPrint closeOnFinish={false} />
    </div>
  );
}
