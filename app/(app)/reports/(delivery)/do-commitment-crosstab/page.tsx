import Link from "next/link";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { OpenReportButton } from "@/components/OpenReportButton";
import { ReportHeader } from "@/components/ReportHeader";
import { getOrInitCompanySettings } from "@/lib/settings";
import { getServerSession } from "@/lib/auth-server";
import {
  fmtQtyCx,
  loadDoCommitmentCrosstab,
  type DoCommitmentCellKey,
} from "./loader";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const z = new Prisma.Decimal(0);

export default async function DoCommitmentCrosstabPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");

  const result = await loadDoCommitmentCrosstab(session);
  if ("type" in result) {
    const settings = await getOrInitCompanySettings();
    return (
      <div className="space-y-6 max-w-xl">
        <ReportHeader
          companyName={settings.companyName}
          department={settings.department}
          logoSrc={settings.logoUrl}
          title="DO quantity commitments (crosstab)"
        />
        <div className="rounded-lg border border-amber-600/40 bg-amber-600/5 px-4 py-3 text-sm text-amber-950 dark:text-amber-200">
          Your role is tied to a sales point, but none is assigned. Ask an
          administrator.
        </div>
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

  const generated = new Date();

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="hidden print:block">
          <ReportHeader
            companyName={settings.companyName}
            department={settings.department}
            logoSrc={settings.logoUrl}
            title="DO quantity commitments (crosstab)"
          />
        </div>
        <div className="print:hidden text-2xl font-bold">
          Stocks Commitments
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            {scopedToSalesPoint ? (
              <p className="text-sm opacity-80">
                <span className="font-medium">Clerk / supervisor view</span> —
                only validated delivery orders and validated sales at{" "}
                <span className="font-medium">{assignedSalesPointName}</span>.
              </p>
            ) : (
              <p className="text-sm opacity-80">
                <span className="font-medium">
                  Senior supervisor / manager (and org-wide roles)
                </span>{" "}
                — validated DO lines vs validated invoiced kg by customer,
                product, and sales point. Positive: not yet fully invoiced;
                negative: over-invoiced vs that product line.
              </p>
            )}
            <p className="mt-1 text-xs tabular-nums opacity-70">
              Generated{" "}
              {generated.toLocaleString("en-GB", {
                dateStyle: "medium",
                timeStyle: "short",
              })}{" "}
              · {ordersCount} validated DO{ordersCount === 1 ? "" : "s"} in
              scope
            </p>
          </div>
          <div>
            <OpenReportButton
              href="/reports/do-commitment-crosstab/print"
              label="Print"
              sameTab
            />
          </div>
        </div>
      </div>

      <p className="text-sm opacity-80">
        For each product, rows are <span className="font-medium">customers</span>{" "}
        (from validated DO lines) and columns are{" "}
        <span className="font-medium">sales points</span>. Each cell is ordered
        quantity on validated DO lines minus kg invoiced on validated sales for
        the same delivery order and product (same scope as{" "}
        <Link href="/reports/customer-delivery-monitor" className="underline">
          DO by customer
        </Link>
        ). Live snapshot — not limited to a single financial period.
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
        <div className="space-y-8">
          {products.map((p) => (
            <section key={p.productId} className="space-y-3">
              <h2 className="text-base font-semibold">{p.productName}</h2>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left align-bottom">
                      <th className="sticky left-0 z-10 bg-background px-3 py-2 font-medium">
                        Customer
                      </th>
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
                        <td className="sticky left-0 z-10 max-w-[min(28rem,55vw)] bg-background px-3 py-2 font-medium">
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
                      <td className="sticky left-0 z-10 bg-background px-3 py-2">
                        Total {p.productName}
                      </td>
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

          <div className="rounded-lg border border-border p-4 text-sm">
            <div className="flex items-center justify-between gap-4">
              <span className="font-medium">Grand total</span>
              <span className="tabular-nums font-semibold">
                {fmtQtyCx(grandTotal)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
