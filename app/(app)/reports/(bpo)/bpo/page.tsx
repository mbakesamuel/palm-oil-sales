import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth-server";
import { roleRequiresSalesPoint } from "@/lib/auth-roles";
import { getOrInitCompanySettings } from "@/lib/settings";
import { getPrismaClient } from "@/lib/prisma";
import { prismaRetry } from "@/lib/prisma-retry";
import { OpenReportButton } from "@/components/OpenReportButton";
import { Prisma, ValidationStatus } from "@prisma/client";

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

  const [settings, saleLines] = await Promise.all([
    getOrInitCompanySettings(),
    prismaRetry(() =>
      prisma.saleLine.findMany({
        where: {
          product: { productCat: { isBottled: true } },
          sale: {
            status: ValidationStatus.VALIDATED,
            ...(scoped && assignedSalesPointId != null ? { salesPointId: assignedSalesPointId } : {}),
          },
        },
        orderBy: { sale: { soldAt: "desc" } },
        take: 100,
        include: {
          product: { select: { productName: true } },
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
      <div className="flex justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Bottled Palm Oil monitor</h1>
          <p className="text-sm opacity-80 mt-1">{settings.companyName}</p>
          <p className="text-xs opacity-70 mt-1">
            Generated {generated.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
          </p>
        </div>
        <div>
          <OpenReportButton href="/reports/bpo/print" label="Print report" />
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Validated BPO sales</h2>
        <p className="text-sm opacity-75">
          Total units: <span className="font-medium tabular-nums">{fmt(salesTotals.qty)}</span> · Net:{" "}
          <span className="font-medium tabular-nums">{xaf(salesTotals.net)}</span> · Gross:{" "}
          <span className="font-medium tabular-nums">{xaf(salesTotals.gross)}</span>
        </p>
        <div className="rounded-lg border border-border overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-3 py-2">Invoice</th>
                <th className="text-left px-3 py-2">Date</th>
                <th className="text-left px-3 py-2">Customer</th>
                <th className="text-left px-3 py-2">Product</th>
                <th className="text-right px-3 py-2">Qty</th>
                <th className="text-right px-3 py-2">Gross</th>
              </tr>
            </thead>
            <tbody>
              {saleLines.map((l) => (
                <tr key={l.id} className="border-b border-border">
                  <td className="px-3 py-2 font-mono text-xs">{l.sale.invoiceNo}</td>
                  <td className="px-3 py-2 tabular-nums">{l.sale.soldAt.toISOString().slice(0, 10)}</td>
                  <td className="px-3 py-2">{l.sale.customerNameSnapshot}</td>
                  <td className="px-3 py-2">{l.product.productName}</td>
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
    </div>
  );
}
