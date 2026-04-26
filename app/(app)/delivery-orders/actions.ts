"use server";

import { getPrismaClient } from "@/lib/prisma";
import { allocateDeliveryOrderNo } from "@/lib/delivery-order-no";
import { PaymentMethod, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

type LineInput = {
  productId: string;
  orderQty: string;
  orderUnit: string;
  unitPrice: string;
};

type PaymentInput = {
  method: "CASH" | "CHEQUE";
  paymentDate: string;
  chequeNo?: string;
  bank?: string;
  cashReceiptNo?: string;
  receiptDate?: string;
};

function d(value: string | number) {
  return new Prisma.Decimal(value);
}

function money2(value: Prisma.Decimal) {
  return value.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

export async function createDeliveryOrder(formData: FormData) {
  const prisma = getPrismaClient();
  const customerId = String(formData.get("customerId") ?? "").trim();
  const dateIssuedRaw = String(formData.get("dateIssued") ?? "").trim();
  const orderRef = String(formData.get("orderRef") ?? "").trim() || null;
  const collectionPoint = String(formData.get("collectionPoint") ?? "").trim() || null;
  const linesJson = String(formData.get("lines") ?? "[]");
  const paymentsJson = String(formData.get("payments") ?? "[]");

  if (!customerId) throw new Error("Customer is required.");

  const dateIssued = dateIssuedRaw ? new Date(`${dateIssuedRaw}T12:00:00`) : new Date();
  if (Number.isNaN(dateIssued.getTime())) throw new Error("Invalid date.");

  const lines = JSON.parse(linesJson) as LineInput[];
  const payments = JSON.parse(paymentsJson) as PaymentInput[];

  if (!Array.isArray(lines) || lines.length === 0) {
    throw new Error("Add at least one line item.");
  }

  let subtotal = d(0);
  const preparedLines = lines.map((l) => {
    const productId = Number.parseInt(l.productId, 10);
    if (!Number.isFinite(productId)) throw new Error("Invalid product.");
    const orderQty = Number.parseInt(l.orderQty, 10);
    if (!Number.isFinite(orderQty) || orderQty <= 0) throw new Error("Quantity must be a positive whole number.");

    const orderUnit = String(l.orderUnit ?? "").trim() || null;
    const unitPriceRaw = String(l.unitPrice ?? "").trim();
    const unitPrice = unitPriceRaw ? money2(d(unitPriceRaw)) : null;
    let amount: Prisma.Decimal | null = null;
    if (unitPrice) {
      amount = money2(unitPrice.mul(d(orderQty)));
      subtotal = subtotal.add(amount);
    }

    return {
      productId,
      orderQty,
      orderUnit,
      unitPrice,
      amount,
    };
  });

  const preparedPayments = (Array.isArray(payments) ? payments : [])
    .filter((p) => p && (p.method === "CASH" || p.method === "CHEQUE"))
    .map((p) => {
      const paymentDate = p.paymentDate ? new Date(`${p.paymentDate}T12:00:00`) : dateIssued;
      if (Number.isNaN(paymentDate.getTime())) throw new Error("Invalid payment date.");
      const method = p.method === "CHEQUE" ? PaymentMethod.CHEQUE : PaymentMethod.CASH;
      return {
        method,
        paymentDate,
        chequeNo: String(p.chequeNo ?? "").trim() || null,
        bank: String(p.bank ?? "").trim() || null,
        cashReceiptNo: String(p.cashReceiptNo ?? "").trim() || null,
        receiptDate: p.receiptDate
          ? (() => {
              const rd = new Date(`${p.receiptDate}T12:00:00`);
              return Number.isNaN(rd.getTime()) ? null : rd;
            })()
          : null,
      };
    });

  const deliveryOrderNo = await allocateDeliveryOrderNo(dateIssued);

  await prisma.deliveryOrder.create({
    data: {
      deliveryOrderNo,
      dateIssued,
      customerId,
      orderRef,
      collectionPoint,
      details: { create: preparedLines },
      payments: preparedPayments.length ? { create: preparedPayments } : undefined,
    },
  });

  revalidatePath("/delivery-orders");
  revalidatePath("/dashboard");
}

export async function deleteDeliveryOrder(formData: FormData) {
  const prisma = getPrismaClient();
  const id = Number.parseInt(String(formData.get("id") ?? ""), 10);
  if (!Number.isFinite(id)) throw new Error("Invalid delivery order.");

  await prisma.deliveryOrder.delete({ where: { id } });

  revalidatePath("/delivery-orders");
  revalidatePath("/dashboard");
}
