import Link from "next/link";
import { notFound } from "next/navigation";
import { getPrismaClient } from "@/lib/prisma";
import { getOrInitCompanySettings } from "@/lib/settings";
import { DeliveryOrderPrint } from "@/components/DeliveryOrderPrint";
import { PrintButton } from "@/components/PrintButton";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function subtotalFromDetails(
  details: Array<{
    orderQty: number;
    unitPrice: Prisma.Decimal | null;
    amount: Prisma.Decimal | null;
  }>,
): string {
  let sum = new Prisma.Decimal(0);
  for (const d of details) {
    if (d.amount != null) {
      sum = sum.add(d.amount);
    } else if (d.unitPrice != null) {
      sum = sum.add(d.unitPrice.mul(d.orderQty));
    }
  }
  return sum.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP).toString();
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

  const subtotal = subtotalFromDetails(order.details);

  const printModel = {
    deliveryOrderNo: order.deliveryOrderNo,
    dateIssuedIso: order.dateIssued.toISOString(),
    orderRef: order.orderRef,
    collectionPoint: order.collectionPoint,
    customer: order.customer,
    details: order.details.map((d, i) => ({
      lineNo: i + 1,
      productName: d.product.productName,
      productCode: d.product.productCode,
      orderQty: d.orderQty,
      orderUnit: d.orderUnit,
      unitPrice: d.unitPrice != null ? d.unitPrice.toString() : null,
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
    subtotal,
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
