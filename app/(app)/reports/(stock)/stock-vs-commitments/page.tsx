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

function fmtKg(d: Prisma.Decimal) {
  const n = Number(d.toDecimalPlaces(3, Prisma.Decimal.ROUND_HALF_UP));
  return new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 3,
    minimumFractionDigits: 0,
  }).format(n);
}

function fmtKgOrDash(d: Prisma.Decimal) {
  if (d.equals(z)) return "—";
  return fmtKg(d);
}

export default async function StockVsCommitmentsReportPage() {
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
            title="Stock vs delivery commitments"
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

  const prisma = getPrismaClient();
  const spWhere =
    scopedToSalesPoint && assignedSalesPointId != null
      ? { salesPointId: assignedSalesPointId }
      : {};

  const doWhere: Prisma.DeliveryOrderWhereInput = {
    status: ValidationStatus.VALIDATED,
    ...spWhere,
  };

  const [settings, salesPointsList, batchRows, orders] = await Promise.all([
    getOrInitCompanySettings(),
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
      prisma.stockLot.findMany({
        where: {
          ...spWhere,
          uom: "KG",
          qtyRemaining: { gt: 0 },
        },
        select: {
          salesPointId: true,
          productId: true,
          qtyRemaining: true,
        },
      }),
    ),
    prismaRetry(() =>
      prisma.deliveryOrder.findMany({
        where: doWhere,
        select: {
          deliveryOrderNo: true,
          salesPointId: true,
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

  const commitBySpProduct = new Map<string, Prisma.Decimal>();
  for (const o of orders) {
    const orderedByProduct = new Map<number, number>();
    for (const d of o.details) {
      orderedByProduct.set(d.productId, (orderedByProduct.get(d.productId) ?? 0) + d.orderQty);
    }
    for (const [productId, orderQty] of orderedByProduct) {
      const orderedQty = new Prisma.Decimal(orderQty);
      const invoiced =
        invoicedQtyByDoNoProduct.get(`${o.deliveryOrderNo}:${productId}`) ?? z;
      const balance = orderedQty.sub(invoiced);
      const k = `${o.salesPointId}:${productId}`;
      commitBySpProduct.set(k, (commitBySpProduct.get(k) ?? z).add(balance));
    }
  }

  const stockBySpProduct = new Map<string, Prisma.Decimal>();
  for (const b of batchRows) {
    const k = `${b.salesPointId}:${b.productId}`;
    stockBySpProduct.set(k, (stockBySpProduct.get(k) ?? z).add(b.qtyRemaining));
  }

  const productIdSet = new Set<number>();
  for (const b of batchRows) productIdSet.add(b.productId);
  for (const o of orders) {
    for (const d of o.details) productIdSet.add(d.productId);
  }
  const productIdsInScope = [...productIdSet];
  const productsCatalog = productIdsInScope.length
    ? await prismaRetry(() =>
        prisma.product.findMany({
          where: { productId: { in: productIdsInScope } },
          select: { productId: true, productName: true },
        }),
      )
    : [];
  const productNameById = new Map(productsCatalog.map((p) => [p.productId, p.productName]));

  const stockVsCommitProducts = [...productIdsInScope]
    .map((productId) => {
      const productName = productNameById.get(productId) ?? `Product ${productId}`;
      const rows = salesPointsList.map((sp) => {
        const stock = stockBySpProduct.get(`${sp.id}:${productId}`) ?? z;
        const commit = commitBySpProduct.get(`${sp.id}:${productId}`) ?? z;
        const balance = stock.sub(commit);
        return {
          salesPointId: sp.id,
          salesPointName: sp.name,
          stock,
          commit,
          balance,
        };
      });
      const stockT = rows.reduce((a, r) => a.add(r.stock), z);
      const commitT = rows.reduce((a, r) => a.add(r.commit), z);
      const balanceT = rows.reduce((a, r) => a.add(r.balance), z);
      return {
        productId,
        productName,
        rows,
        totals: { stock: stockT, commit: commitT, balance: balanceT },
      };
    })
    .filter(
      (b) =>
        b.totals.stock.gt(0) ||
        !b.totals.commit.equals(z) ||
        b.rows.some((r) => r.stock.gt(0) || !r.commit.equals(z)),
    )
    .sort((a, b) =>
      a.productName.localeCompare(b.productName, undefined, { sensitivity: "base" }),
    );

  const summaryBySalesPoint =
    stockVsCommitProducts.length > 0
      ? salesPointsList.map((sp) => {
          let stock = z;
          let commit = z;
          let balance = z;
          for (const block of stockVsCommitProducts) {
            const r = block.rows.find((x) => x.salesPointId === sp.id);
            if (r) {
              stock = stock.add(r.stock);
              commit = commit.add(r.commit);
              balance = balance.add(r.balance);
            }
          }
          return {
            salesPointId: sp.id,
            salesPointName: sp.name,
            stock,
            commit,
            balance,
          };
        })
      : [];

  const summaryGrand =
    summaryBySalesPoint.length > 0
      ? summaryBySalesPoint.reduce(
          (acc, r) => ({
            stock: acc.stock.add(r.stock),
            commit: acc.commit.add(r.commit),
            balance: acc.balance.add(r.balance),
          }),
          { stock: z, commit: z, balance: z },
        )
      : null;

  const generated = new Date();

  return (
    <div className="space-y-8">
      <div className="space-y-3 print:block">
        <ReportHeader
          companyName={settings.companyName}
          department={settings.department}
          logoSrc={settings.logoUrl}
          title={
            scopedToSalesPoint && assignedSalesPointName
              ? `Stock vs commitments at ${assignedSalesPointName}`
              : "Stock vs commitments (all sales points)"
          }
        />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm opacity-80 max-w-3xl">
              For each product: physical stock (remaining kg from receipts) and outstanding validated
              delivery order quantity (ordered kg minus invoiced kg) by collection point — same commit
              basis as the{" "}
              <Link href="/reports/do-commitment-crosstab" className="underline">
                DO commitments crosstab
              </Link>
              . <span className="font-medium">Balance</span> is stock minus commit.
            </p>
            <p className="mt-1 text-xs tabular-nums opacity-70">
              Generated{" "}
              {generated.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
            </p>
          </div>
          <div className="print:hidden">
            <PrintButton label="Print" />
          </div>
        </div>
      </div>

      {stockVsCommitProducts.length === 0 ? (
        <p className="text-sm opacity-75">
          No stock or delivery commitments in scope (record receipts and validated DOs / sales).
        </p>
      ) : (
        <div className="space-y-6">
          {stockVsCommitProducts.map((block) => (
            <div
              key={block.productId}
              className="space-y-2 rounded-lg border border-border p-4 print:break-inside-avoid"
            >
              <h2 className="text-lg font-semibold">{block.productName}</h2>
              <div className="overflow-x-auto rounded-md border border-border">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="px-3 py-2 font-medium">Sales point</th>
                      <th className="px-3 py-2 font-medium text-right">Stock (kg)</th>
                      <th className="px-3 py-2 font-medium text-right">Commit (kg)</th>
                      <th className="px-3 py-2 font-medium text-right">Balance (kg)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((r) => (
                      <tr
                        key={r.salesPointId}
                        className="border-b border-border odd:bg-foreground/4"
                      >
                        <td className="px-3 py-2">{r.salesPointName}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmtKgOrDash(r.stock)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmtKgOrDash(r.commit)}</td>
                        <td className="px-3 py-2 text-right tabular-nums font-medium">
                          {fmtKg(r.balance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-border font-medium">
                      <td className="px-3 py-2">Total</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {fmtKgOrDash(block.totals.stock)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {fmtKgOrDash(block.totals.commit)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmtKg(block.totals.balance)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          ))}

          {summaryGrand ? (
            <section className="space-y-2 rounded-lg border border-border p-4 print:break-inside-avoid">
              <h2 className="text-lg font-semibold">Summary by sales point (all products above)</h2>
              <p className="text-sm opacity-75">
                Totals of stock, outstanding commit, and balance across every product included in this
                report.
              </p>
              <div className="overflow-x-auto rounded-md border border-border">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="px-3 py-2 font-medium">Sales point</th>
                      <th className="px-3 py-2 font-medium text-right">Stock (kg)</th>
                      <th className="px-3 py-2 font-medium text-right">Commit (kg)</th>
                      <th className="px-3 py-2 font-medium text-right">Balance (kg)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summaryBySalesPoint.map((r) => (
                      <tr
                        key={r.salesPointId}
                        className="border-b border-border odd:bg-foreground/4"
                      >
                        <td className="px-3 py-2">{r.salesPointName}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmtKgOrDash(r.stock)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmtKgOrDash(r.commit)}</td>
                        <td className="px-3 py-2 text-right tabular-nums font-medium">
                          {fmtKg(r.balance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-border font-medium">
                      <td className="px-3 py-2">Grand total</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {fmtKgOrDash(summaryGrand.stock)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {fmtKgOrDash(summaryGrand.commit)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmtKg(summaryGrand.balance)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>
          ) : null}
        </div>
      )}

      <div className="hidden print:block">
        <ReportSignatory />
      </div>
    </div>
  );
}
