import Link from "next/link";
import { redirect } from "next/navigation";
import { getPrismaClient } from "@/lib/prisma";
import { getOrInitCompanySettings } from "@/lib/settings";
import { prismaRetry } from "@/lib/prisma-retry";
import { PrintButton } from "@/components/PrintButton";
import { ReportHeader } from "@/components/ReportHeader";
import { ReportSignatory } from "@/components/ReportSignatory";
import { Prisma, ValidationStatus } from "@prisma/client";
import { getServerSession } from "@/lib/auth-server";
import { roleRequiresSalesPoint } from "@/lib/auth-roles";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const z = new Prisma.Decimal(0);

function fmtQty(d: Prisma.Decimal) {
  const n = Number(d.toDecimalPlaces(3, Prisma.Decimal.ROUND_HALF_UP));
  return new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 3,
    minimumFractionDigits: 0,
  }).format(n);
}

export default async function DoCommitmentCrosstabPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");

  const scopedToSalesPoint = roleRequiresSalesPoint(session.role);
  const assignedSalesPointId = session.salesPoint?.id ?? null;
  const assignedSalesPointName = session.salesPoint?.name ?? null;

  if (scopedToSalesPoint && assignedSalesPointId == null) {
    const settings = await getOrInitCompanySettings();
    return (
      <div className="space-y-6 max-w-xl">
        <div className="space-y-3 print:block">
          <ReportHeader
            companyName={settings.companyName}
            department={settings.department}
            logoSrc={settings.logoUrl}
            title="DO quantity commitments (crosstab)"
          />
        </div>
        <div className="rounded-lg border border-amber-600/40 bg-amber-600/5 px-4 py-3 text-sm text-amber-950 dark:text-amber-200">
          Your role is tied to a sales point, but none is assigned. Ask an administrator.
        </div>
        <div className="hidden print:block">
          <ReportSignatory />
        </div>
      </div>
    );
  }

  const [settings, prisma] = await Promise.all([getOrInitCompanySettings(), getPrismaClient()]);

  const doWhere: Prisma.DeliveryOrderWhereInput = {
    status: ValidationStatus.VALIDATED,
    ...(scopedToSalesPoint && assignedSalesPointId != null
      ? { salesPointId: assignedSalesPointId }
      : {}),
  };

  const [salesPoints, orders] = await Promise.all([
    prismaRetry(() =>
      prisma.salesPoint.findMany({
        where:
          scopedToSalesPoint && assignedSalesPointId != null
            ? { id: assignedSalesPointId }
            : {},
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
    ),
    prismaRetry(() =>
      prisma.deliveryOrder.findMany({
        where: doWhere,
        select: {
          deliveryOrderNo: true,
          customerId: true,
          salesPointId: true,
          customer: { select: { id: true, name: true } },
          details: {
            select: {
              orderQty: true,
              productId: true,
              product: { select: { productName: true } },
            },
          },
        },
      }),
    ),
  ]);

  const deliveryOrderNos = [...new Set(orders.map((o) => o.deliveryOrderNo))];
  const sales =
    deliveryOrderNos.length > 0
      ? await prismaRetry(() =>
          prisma.sale.findMany({
            where: {
              deliveryOrderNo: { in: deliveryOrderNos },
              status: ValidationStatus.VALIDATED,
              ...(scopedToSalesPoint && assignedSalesPointId != null
                ? { salesPointId: assignedSalesPointId }
                : {}),
            },
            select: {
              deliveryOrderNo: true,
              lines: { select: { productId: true, qtyKg: true } },
            },
          }),
        )
      : [];

  /** Invoiced kg per DO number and product (validated sales). */
  const invoicedQtyByDoNoProduct = new Map<string, Prisma.Decimal>();
  for (const s of sales) {
    const no = s.deliveryOrderNo ?? "";
    if (!no) continue;
    for (const l of s.lines) {
      const k = `${no}:${l.productId}`;
      invoicedQtyByDoNoProduct.set(
        k,
        (invoicedQtyByDoNoProduct.get(k) ?? z).add(l.qtyKg),
      );
    }
  }

  type CellKey = `${string}:${number}:${number}`;
  const cellBalance = new Map<CellKey, Prisma.Decimal>();

  type RowKey = `${string}:${number}`;
  const rowLabel = new Map<RowKey, string>();

  for (const o of orders) {
    const customerName = o.customer.name;
    const orderedByProduct = new Map<number, { orderQty: number; productName: string }>();
    for (const d of o.details) {
      const ex = orderedByProduct.get(d.productId);
      if (ex) ex.orderQty += d.orderQty;
      else
        orderedByProduct.set(d.productId, {
          orderQty: d.orderQty,
          productName: d.product.productName,
        });
    }
    for (const [productId, { orderQty, productName }] of orderedByProduct) {
      const rk: RowKey = `${o.customerId}:${productId}`;
      if (!rowLabel.has(rk)) rowLabel.set(rk, `${customerName} - ${productName}`);
      const orderedQty = new Prisma.Decimal(orderQty);
      const invoiced =
        invoicedQtyByDoNoProduct.get(`${o.deliveryOrderNo}:${productId}`) ?? z;
      const balance = orderedQty.sub(invoiced);
      const ck: CellKey = `${o.customerId}:${productId}:${o.salesPointId}`;
      cellBalance.set(ck, (cellBalance.get(ck) ?? z).add(balance));
    }
  }

  const rowKeys = [...rowLabel.keys()].sort((a, b) =>
    (rowLabel.get(a) ?? "").localeCompare(rowLabel.get(b) ?? "", undefined, {
      sensitivity: "base",
    }),
  );

  const rowTotals = new Map<RowKey, Prisma.Decimal>();
  const colTotals = new Map<number, Prisma.Decimal>();
  let grandTotal = z;

  for (const rk of rowKeys) {
    const [cid, pidStr] = rk.split(":");
    const productId = Number(pidStr);
    let row = z;
    for (const sp of salesPoints) {
      const v = cellBalance.get(`${cid}:${productId}:${sp.id}` as CellKey) ?? z;
      row = row.add(v);
    }
    rowTotals.set(rk, row);
    grandTotal = grandTotal.add(row);
  }

  for (const sp of salesPoints) {
    let col = z;
    for (const rk of rowKeys) {
      const [cid, pidStr] = rk.split(":");
      const productId = Number(pidStr);
      col = col.add(cellBalance.get(`${cid}:${productId}:${sp.id}` as CellKey) ?? z);
    }
    colTotals.set(sp.id, col);
  }

  const generated = new Date();

  return (
    <div className="space-y-6">
      <div className="space-y-3 print:block">
        <ReportHeader
          companyName={settings.companyName}
          department={settings.department}
          logoSrc={settings.logoUrl}
          title="DO quantity commitments (crosstab)"
        />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            {scopedToSalesPoint ? (
              <p className="text-sm opacity-80">
                <span className="font-medium">Clerk / supervisor view</span> — only validated
                delivery orders and validated sales at{" "}
                <span className="font-medium">{assignedSalesPointName}</span>.
              </p>
            ) : (
              <p className="text-sm opacity-80">
                <span className="font-medium">Senior supervisor / manager (and org-wide roles)</span>{" "}
                — validated DO lines vs validated invoiced kg by customer, product, and sales point.
                Positive: not yet fully invoiced; negative: over-invoiced vs that product line.
              </p>
            )}
            <p className="mt-1 text-xs tabular-nums opacity-70">
              Generated{" "}
              {generated.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })} ·{" "}
              {orders.length} validated DO{orders.length === 1 ? "" : "s"} in scope
            </p>
          </div>
          <div className="print:hidden">
            <PrintButton label="Print" />
          </div>
        </div>
      </div>

      <p className="text-sm opacity-80">
        Rows are <span className="font-medium">customer - product</span> (from DO lines). Each cell
        is ordered quantity on validated DO lines for that product minus kg invoiced on validated
        sales for the same delivery order and product (same scope as{" "}
        <Link href="/reports/customer-delivery-monitor" className="underline">
          DO by customer
        </Link>
        ). Live snapshot — not limited to a single financial period.
      </p>

      {orders.length === 0 ? (
        <p className="text-sm opacity-75">No validated delivery orders in scope.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border print:break-inside-avoid">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left align-bottom">
                <th className="sticky left-0 z-10 bg-background px-3 py-2 font-medium">
                  Customer - product
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
                <th className="border-l border-border px-3 py-2 text-right font-medium">
                  Row total
                </th>
              </tr>
            </thead>
            <tbody>
              {rowKeys.map((rk) => {
                const colon = rk.lastIndexOf(":");
                const cid = rk.slice(0, colon);
                const productId = Number(rk.slice(colon + 1));
                return (
                  <tr
                    key={rk}
                    className="border-b border-border odd:bg-foreground/[0.04]"
                  >
                    <td className="sticky left-0 z-10 max-w-[min(28rem,55vw)] bg-background px-3 py-2 font-medium">
                      <span className="whitespace-normal">{rowLabel.get(rk) ?? rk}</span>
                    </td>
                    {salesPoints.map((sp) => {
                      const v = cellBalance.get(`${cid}:${productId}:${sp.id}` as CellKey) ?? z;
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
                          {fmtQty(v)}
                        </td>
                      );
                    })}
                    <td className="border-l border-border px-3 py-2 text-right font-medium tabular-nums">
                      {fmtQty(rowTotals.get(rk) ?? z)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border font-medium">
                <td className="sticky left-0 z-10 bg-background px-3 py-2">
                  Column totals
                </td>
                {salesPoints.map((sp) => (
                  <td key={sp.id} className="px-3 py-2 text-right tabular-nums">
                    {fmtQty(colTotals.get(sp.id) ?? z)}
                  </td>
                ))}
                <td className="border-l border-border px-3 py-2 text-right tabular-nums">
                  {fmtQty(grandTotal)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <div className="hidden print:block">
        <ReportSignatory />
      </div>
    </div>
  );
}
