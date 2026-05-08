import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth-server";
import { roleRequiresSalesPoint } from "@/lib/auth-roles";
import { getOrInitCompanySettings } from "@/lib/settings";
import { getPrismaClient } from "@/lib/prisma";
import { prismaRetry } from "@/lib/prisma-retry";
import { PrintButton } from "@/components/PrintButton";
import { ReportSignatory } from "@/components/ReportSignatory";
import { BpoMovementStatus, BpoMovementType, Prisma, ValidationStatus } from "@prisma/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const z = new Prisma.Decimal(0);

function fmt(d: Prisma.Decimal) {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 3 }).format(
    Number(d.toDecimalPlaces(3, Prisma.Decimal.ROUND_HALF_UP)),
  );
}

function xaf(d: Prisma.Decimal) {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(
    Number(d.toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP)),
  );
}

export default async function BpoReportPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  const scoped = roleRequiresSalesPoint(session.role);
  const assignedSalesPointId = session.salesPoint?.id ?? null;
  const prisma = getPrismaClient();

  const [settings, stockRows, movements, saleLines] = await Promise.all([
    getOrInitCompanySettings(),
    prismaRetry(() =>
      prisma.bpoStockBatch.findMany({
        where: scoped && assignedSalesPointId != null ? { salesPointId: assignedSalesPointId } : {},
        select: {
          salesPoint: { select: { name: true } },
          productVariantId: true,
          qtyRemainingUnits: true,
          productVariant: { select: { name: true, product: { select: { productName: true } } } },
        },
      }),
    ),
    prismaRetry(() =>
      prisma.bpoStockMovement.findMany({
        where:
          scoped && assignedSalesPointId != null
            ? {
                OR: [
                  { sourceSalesPointId: assignedSalesPointId },
                  { destinationSalesPointId: assignedSalesPointId },
                ],
              }
            : {},
        orderBy: { createdAt: "desc" },
        take: 100,
        include: {
          sourceSalesPoint: { select: { name: true } },
          destinationSalesPoint: { select: { name: true } },
          senderValidatedBy: { select: { name: true } },
          botaValidatedBy: { select: { name: true } },
          lines: {
            include: {
              productVariant: {
                select: { name: true, product: { select: { productName: true } } },
              },
            },
          },
        },
      }),
    ),
    prismaRetry(() =>
      prisma.saleLine.findMany({
        where: {
          product: { isBottledPalmOil: true },
          sale: {
            status: ValidationStatus.VALIDATED,
            ...(scoped && assignedSalesPointId != null ? { salesPointId: assignedSalesPointId } : {}),
          },
        },
        orderBy: { sale: { soldAt: "desc" } },
        take: 100,
        include: {
          productVariant: { select: { name: true, product: { select: { productName: true } } } },
          sale: {
            select: {
              invoiceNo: true,
              soldAt: true,
              customerNameSnapshot: true,
              salesPoint: { select: { name: true } },
            },
          },
        },
      }),
    ),
  ]);

  const stockByKey = new Map<string, { salesPoint: string; variant: string; qty: Prisma.Decimal }>();
  for (const row of stockRows) {
    const variant = `${row.productVariant.product.productName} - ${row.productVariant.name}`;
    const key = `${row.salesPoint.name}:${variant}`;
    const existing = stockByKey.get(key);
    if (existing) existing.qty = existing.qty.add(row.qtyRemainingUnits);
    else stockByKey.set(key, { salesPoint: row.salesPoint.name, variant, qty: row.qtyRemainingUnits });
  }
  const stock = [...stockByKey.values()].sort((a, b) =>
    `${a.salesPoint} ${a.variant}`.localeCompare(`${b.salesPoint} ${b.variant}`),
  );

  const salesTotals = saleLines.reduce(
    (acc, l) => ({
      qty: acc.qty.add(l.qtyUnits ?? z),
      net: acc.net.add(l.lineNet),
      gross: acc.gross.add(l.lineGross),
    }),
    { qty: z, net: z, gross: z },
  );

  const generated = new Date();

  return (
    <div className="space-y-8">
      <div className="flex justify-between gap-4 print:block">
        <div>
          <h1 className="text-2xl font-semibold">Bottled Palm Oil monitor</h1>
          <p className="text-sm opacity-80 mt-1">{settings.companyName}</p>
          <p className="text-xs opacity-70 mt-1">
            Generated {generated.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
          </p>
        </div>
        <div className="print:hidden">
          <PrintButton label="Print report" />
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Stock on hand</h2>
        <div className="rounded-lg border border-black/10 dark:border-white/10 overflow-hidden">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-black/10 dark:border-white/10">
                <th className="text-left px-3 py-2">Sales point</th>
                <th className="text-left px-3 py-2">Variant</th>
                <th className="text-right px-3 py-2">Qty units</th>
              </tr>
            </thead>
            <tbody>
              {stock.map((r) => (
                <tr key={`${r.salesPoint}-${r.variant}`} className="border-b border-black/5 dark:border-white/5">
                  <td className="px-3 py-2">{r.salesPoint}</td>
                  <td className="px-3 py-2">{r.variant}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmt(r.qty)}</td>
                </tr>
              ))}
              {stock.length === 0 ? (
                <tr><td className="px-3 py-3 opacity-70" colSpan={3}>No BPO stock on hand.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Consignment pipeline and movements</h2>
        <div className="rounded-lg border border-black/10 dark:border-white/10 overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm border-collapse">
            <thead>
              <tr className="border-b border-black/10 dark:border-white/10">
                <th className="text-left px-3 py-2">Voucher</th>
                <th className="text-left px-3 py-2">Type</th>
                <th className="text-left px-3 py-2">Status</th>
                <th className="text-left px-3 py-2">From</th>
                <th className="text-left px-3 py-2">To</th>
                <th className="text-left px-3 py-2">Qty detail</th>
                <th className="text-left px-3 py-2">Validators</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((m) => (
                <tr key={m.id} className="border-b border-black/5 dark:border-white/5 align-top">
                  <td className="px-3 py-2 font-mono text-xs">{m.voucherNo}</td>
                  <td className="px-3 py-2">{m.movementType === BpoMovementType.CONSIGNMENT_TRANSFER ? "Consignment" : m.reason ?? m.movementType}</td>
                  <td className="px-3 py-2">{m.status}</td>
                  <td className="px-3 py-2">{m.sourceSalesPoint?.name ?? "—"}</td>
                  <td className="px-3 py-2">{m.destinationSalesPoint?.name ?? "—"}</td>
                  <td className="px-3 py-2">
                    {m.lines.map((l) => (
                      <div key={l.id}>
                        {l.productVariant.product.productName} - {l.productVariant.name}: voucher {fmt(l.voucherQtyUnits)}
                        {m.status === BpoMovementStatus.VALIDATED ? `, actual ${fmt(l.actualQtyUnits ?? z)}` : ""}
                      </div>
                    ))}
                    {m.discrepancyNote ? <div className="text-amber-800 dark:text-amber-300">Discrepancy: {m.discrepancyNote}</div> : null}
                  </td>
                  <td className="px-3 py-2">
                    <div>Sender: {m.senderValidatedBy?.name ?? "—"}</div>
                    <div>Bota: {m.botaValidatedBy?.name ?? "—"}</div>
                  </td>
                </tr>
              ))}
              {movements.length === 0 ? (
                <tr><td className="px-3 py-3 opacity-70" colSpan={7}>No BPO movements yet.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Validated BPO sales</h2>
        <p className="text-sm opacity-75">
          Total units: <span className="font-medium tabular-nums">{fmt(salesTotals.qty)}</span> · Net:{" "}
          <span className="font-medium tabular-nums">{xaf(salesTotals.net)}</span> · Gross:{" "}
          <span className="font-medium tabular-nums">{xaf(salesTotals.gross)}</span>
        </p>
        <div className="rounded-lg border border-black/10 dark:border-white/10 overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm border-collapse">
            <thead>
              <tr className="border-b border-black/10 dark:border-white/10">
                <th className="text-left px-3 py-2">Invoice</th>
                <th className="text-left px-3 py-2">Date</th>
                <th className="text-left px-3 py-2">Customer</th>
                <th className="text-left px-3 py-2">Variant</th>
                <th className="text-right px-3 py-2">Qty</th>
                <th className="text-right px-3 py-2">Gross</th>
              </tr>
            </thead>
            <tbody>
              {saleLines.map((l) => (
                <tr key={l.id} className="border-b border-black/5 dark:border-white/5">
                  <td className="px-3 py-2 font-mono text-xs">{l.sale.invoiceNo}</td>
                  <td className="px-3 py-2 tabular-nums">{l.sale.soldAt.toISOString().slice(0, 10)}</td>
                  <td className="px-3 py-2">{l.sale.customerNameSnapshot}</td>
                  <td className="px-3 py-2">
                    {l.productVariant ? `${l.productVariant.product.productName} - ${l.productVariant.name}` : "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmt(l.qtyUnits ?? z)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{xaf(l.lineGross)}</td>
                </tr>
              ))}
              {saleLines.length === 0 ? (
                <tr><td className="px-3 py-3 opacity-70" colSpan={6}>No validated BPO sales yet.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <div className="hidden print:block">
        <ReportSignatory />
      </div>
    </div>
  );
}
