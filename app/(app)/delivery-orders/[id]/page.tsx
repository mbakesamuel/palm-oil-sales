import Link from "next/link";
import { notFound } from "next/navigation";
import { getPrismaClient } from "@/lib/prisma";
import { getOrInitCompanySettings } from "@/lib/settings";
import { DeliveryOrderPrint } from "@/components/DeliveryOrderPrint";
import { PrintButton } from "@/components/PrintButton";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function money2(value: Prisma.Decimal) {
  return value.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

function totalsFromDetails(
  details: Array<{
    orderQty: number;
    unitPrice: Prisma.Decimal | null;
    lineSubtotalExTax: Prisma.Decimal | null;
    vatAmount: Prisma.Decimal | null;
    otherTaxAmount: Prisma.Decimal | null;
    amount: Prisma.Decimal | null;
  }>,
) {
  const z = new Prisma.Decimal(0);
  let subEx = z;
  let totVat = z;
  let totOther = z;
  let grand = z;

  for (const d of details) {
    const net =
      d.lineSubtotalExTax != null
        ? d.lineSubtotalExTax
        : d.unitPrice != null
          ? money2(d.unitPrice.mul(d.orderQty))
          : z;
    subEx = subEx.add(net);

    if (d.vatAmount != null) totVat = totVat.add(d.vatAmount);
    if (d.otherTaxAmount != null) totOther = totOther.add(d.otherTaxAmount);

    if (d.amount != null) {
      grand = grand.add(d.amount);
    } else {
      const v = d.vatAmount ?? z;
      const o = d.otherTaxAmount ?? z;
      grand = grand.add(money2(net.add(v).add(o)));
    }
  }

  return {
    subtotalExTax: money2(subEx).toString(),
    totalVat: money2(totVat).toString(),
    totalOtherTax: money2(totOther).toString(),
    grandTotal: money2(grand).toString(),
  };
}

export default async function DeliveryOrderDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id: idParam } = await props.params;
  const id = Number.parseInt(idParam, 10);
  if (!Number.isFinite(id)) notFound();

  const prisma = getPrismaClient();
  const [settings, order] = await Promise.all([
    getOrInitCompanySettings(),
    prisma.deliveryOrder.findUnique({
      where: { id },
      include: {
        salesPoint: { select: { name: true } },
        customer: {
          select: {
            name: true,
            phone: true,
            address: true,
            taxpayerId: true,
          },
        },
        details: {
          orderBy: { id: "asc" },
          include: {
            product: {
              select: { productName: true, productCode: true },
            },
          },
        },
        payments: { orderBy: { id: "asc" } },
      },
    }),
  ]);

  if (!order) notFound();

  const t = totalsFromDetails(order.details);

  const printModel = {
    deliveryOrderNo: order.deliveryOrderNo,
    dateIssuedIso: order.dateIssued.toISOString(),
    orderRef: order.orderRef,
    collectionPoint: order.salesPoint.name,
    customer: order.customer,
    details: order.details.map((d, i) => ({
      lineNo: i + 1,
      productName: d.product.productName,
      productCode: d.product.productCode,
      orderQty: d.orderQty,
      orderUnit: d.orderUnit,
      unitPrice: d.unitPrice != null ? d.unitPrice.toString() : null,
      lineSubtotalExTax: d.lineSubtotalExTax != null ? d.lineSubtotalExTax.toString() : null,
      vatAmount: d.vatAmount != null ? d.vatAmount.toString() : null,
      otherTaxLabel: d.otherTaxLabel,
      otherTaxAmount: d.otherTaxAmount != null ? d.otherTaxAmount.toString() : null,
      amount: d.amount != null ? d.amount.toString() : null,
    })),
    payments: order.payments.map((p) => ({
      method: p.method,
      paymentDateIso: p.paymentDate.toISOString(),
      chequeNo: p.chequeNo,
      bank: p.bank,
      cashReceiptNo: p.cashReceiptNo,
      receiptDateIso: p.receiptDate ? p.receiptDate.toISOString() : null,
    })),
    subtotalExTax: t.subtotalExTax,
    totalVat: t.totalVat,
    totalOtherTax: t.totalOtherTax,
    grandTotal: t.grandTotal,
  };

  return (
    <div className="space-y-6">
      <div className="print:hidden flex flex-wrap items-center gap-3">
        <Link
          href="/delivery-orders"
          className="text-sm underline underline-offset-4 opacity-80 hover:opacity-100"
        >
          ← All delivery orders
        </Link>
        <PrintButton />
      </div>

      <DeliveryOrderPrint
        companyName={settings.companyName}
        department={settings.department ?? null}
        companyPhone={settings.phone ?? null}
        companyAddress={settings.address ?? null}
        order={printModel}
      />
    </div>
  );
}
