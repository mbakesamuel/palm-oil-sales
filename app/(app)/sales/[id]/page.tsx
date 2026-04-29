import Link from "next/link";
import { notFound } from "next/navigation";
import { getPrismaClient } from "@/lib/prisma";
import { getOrInitCompanySettings } from "@/lib/settings";
import { PrintButton } from "@/components/PrintButton";
import { SalePrint } from "@/components/SalePrint";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function SaleDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  if (!id) notFound();

  const prisma = getPrismaClient();
  const [settings, sale] = await Promise.all([
    getOrInitCompanySettings(),
    prisma.sale.findUnique({
      where: { id },
      include: {
        customer: {
          select: {
            name: true,
            taxpayerId: true,
            taxRegime: { select: { vatApplies: true } },
          },
        },
        lines: {
          orderBy: { id: "asc" },
          include: { product: { include: { productCat: true } } },
        },
        payments: { orderBy: { id: "asc" } },
      },
    }),
  ]);

  if (!sale) notFound();

  return (
    <div className="space-y-4">
      <div className="print:hidden flex items-center justify-between gap-3">
        <Link href="/pos" className="text-sm underline underline-offset-4 opacity-80 hover:opacity-100">
          Back to sales
        </Link>
        <PrintButton label="Print" />
      </div>

      <SalePrint
        companyName={settings.companyName}
        department={settings.department ?? null}
        companyPhone={settings.phone ?? null}
        companyAddress={settings.address ?? null}
        sale={{
          invoiceNo: sale.invoiceNo,
          soldAtIso: sale.soldAt.toISOString(),
          vehicleNumber: sale.vehicleNumber,
          dateIssuedIso: (sale.dateIssued ?? sale.soldAt).toISOString(),
          deliveryOrderNo: sale.deliveryOrderNo,
          customerName: sale.customer.name,
          taxpayerId: sale.customer.taxpayerId,
          vatApplies: sale.customer.taxRegime.vatApplies,
          lines: sale.lines.map((l, idx) => ({
            lineNo: idx + 1,
            productName: l.product.productName,
            productCat: l.product.productCat.productCat,
            qtyKg: l.qtyKg.toString(),
            unitPricePerKg: l.unitPricePerKg.toString(),
            lineNet: l.lineNet.toString(),
          })),
          netAmount: sale.netAmount.toString(),
          vatAmount: sale.vatAmount.toString(),
          grossAmount: sale.grossAmount.toString(),
          payments: sale.payments.map((p) => ({
            method: p.method,
            amount: p.amount.toString(),
            chequeNo: p.chequeNo ?? null,
            paidAtIso: p.paidAt.toISOString(),
          })),
        }}
      />
    </div>
  );
}

