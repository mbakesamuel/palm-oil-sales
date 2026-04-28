"use server";

import { getPrismaClient } from "@/lib/prisma";
import { allocateDeliveryOrderNo } from "@/lib/delivery-order-no";
import { assertPostingPeriod, getOpenFinancialYearPeriod } from "@/lib/financial-year";
import { getOrInitCompanySettings } from "@/lib/settings";
import { PaymentMethod, Prisma, ValidationStatus, UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";

export type SaveHeaderResult =
  | { ok: true; id: number; deliveryOrderNo: string }
  | { ok: false; error: string };

export type SaveSectionResult = { ok: true } | { ok: false; error: string };

export type LoadedDeliveryOrderView = {
  id: number;
  deliveryOrderNo: string;
  referenceNumber: string | null;
  customerId: string;
  customerName: string;
  vatApplies: boolean;
  dateIssued: string;
  orderRef: string | null;
  salesPointId: number | null;
  status: ValidationStatus;
  createdByUserId: string | null;
  createdByName: string | null;
  validatedByUserId: string | null;
  validatedByName: string | null;
  validatedAtIso: string | null;
  lines: Array<{
    productId: number;
    productName: string;
    orderQty: number;
    orderUnit: string;
    unitPrice: string;
    lineSubtotalExTax: string;
    vatRate: string;
    vatAmount: string;
    otherTaxLabel: string;
    otherTaxAmount: string;
    amount: string;
  }>;
  payments: Array<{
    method: PaymentMethod;
    paymentDate: string;
    chequeNo: string;
    bank: string;
    cashReceiptNo: string;
    receiptDate: string;
  }>;
  financialYear: number | null;
  financialMonth: number | null;
};

type LineInput = {
  productId: string;
  orderQty: string;
  orderUnit: string;
  unitPrice: string;
  otherTaxLabel: string;
  otherTaxAmount: string;
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

function revalidateOrderPaths(id: number) {
  revalidatePath("/delivery-orders");
  revalidatePath(`/delivery-orders/${id}`);
  revalidatePath("/dashboard");
}

export async function loadDeliveryOrderByNo(rawNo: string): Promise<LoadedDeliveryOrderView | null> {
  const deliveryOrderNo = String(rawNo ?? "").trim();
  if (!deliveryOrderNo) return null;

  const prisma = getPrismaClient();
  const order = await prisma.deliveryOrder.findUnique({
    where: { deliveryOrderNo },
    include: {
      customer: {
        select: {
          id: true,
          name: true,
          taxRegime: { select: { vatApplies: true } },
        },
      },
      details: {
        orderBy: { id: "asc" },
        include: {
          product: { select: { productName: true } },
        },
      },
      payments: { orderBy: { id: "asc" } },
      createdBy: { select: { id: true, name: true } },
      validatedBy: { select: { id: true, name: true } },
    },
  });

  if (!order) return null;

  return {
    id: order.id,
    deliveryOrderNo: order.deliveryOrderNo,
    referenceNumber: order.referenceNumber ?? null,
    customerId: order.customerId,
    customerName: order.customer.name,
    vatApplies: order.customer.taxRegime.vatApplies,
    dateIssued: order.dateIssued.toISOString().slice(0, 10),
    orderRef: order.orderRef,
    salesPointId: order.salesPointId,
    status: order.status,
    createdByUserId: order.createdByUserId ?? null,
    createdByName: order.createdBy?.name ?? null,
    validatedByUserId: order.validatedByUserId ?? null,
    validatedByName: order.validatedBy?.name ?? null,
    validatedAtIso: order.validatedAt ? order.validatedAt.toISOString() : null,
    lines: order.details.map((det) => ({
      productId: det.productId,
      productName: det.product.productName,
      orderQty: det.orderQty,
      orderUnit: det.orderUnit ?? "",
      unitPrice: det.unitPrice != null ? det.unitPrice.toString() : "",
      lineSubtotalExTax: det.lineSubtotalExTax != null ? det.lineSubtotalExTax.toString() : "",
      vatRate: det.vatRate != null ? det.vatRate.toString() : "",
      vatAmount: det.vatAmount != null ? det.vatAmount.toString() : "",
      otherTaxLabel: det.otherTaxLabel ?? "",
      otherTaxAmount: det.otherTaxAmount != null ? det.otherTaxAmount.toString() : "",
      amount: det.amount != null ? det.amount.toString() : "",
    })),
    payments: order.payments.map((p) => ({
      method: p.method,
      paymentDate: p.paymentDate.toISOString().slice(0, 10),
      chequeNo: p.chequeNo ?? "",
      bank: p.bank ?? "",
      cashReceiptNo: p.cashReceiptNo ?? "",
      receiptDate: p.receiptDate ? p.receiptDate.toISOString().slice(0, 10) : "",
    })),
    financialYear: order.financialYear,
    financialMonth: order.financialMonth,
  };
}

export async function saveDeliveryOrderHeader(formData: FormData): Promise<SaveHeaderResult> {
  const prisma = getPrismaClient();
  const idRaw = String(formData.get("id") ?? "").trim();
  const customerId = String(formData.get("customerId") ?? "").trim();
  const dateIssuedRaw = String(formData.get("dateIssued") ?? "").trim();
  const orderRef = String(formData.get("orderRef") ?? "").trim() || null;
  const referenceNumber = String(formData.get("referenceNumber") ?? "").trim() || null;
  const createdByUserId = String(formData.get("createdByUserId") ?? "").trim() || null;
  const salesPointRaw = String(formData.get("salesPointId") ?? "").trim();
  let salesPointId: number | null = null;
  if (salesPointRaw) {
    const sp = Number.parseInt(salesPointRaw, 10);
    if (!Number.isFinite(sp)) return { ok: false, error: "Invalid sales point." };
    salesPointId = sp;
  }

  if (!customerId) return { ok: false, error: "Customer is required." };

  const dateIssued = dateIssuedRaw ? new Date(`${dateIssuedRaw}T12:00:00`) : new Date();
  if (Number.isNaN(dateIssued.getTime())) return { ok: false, error: "Invalid date." };

  const postingFYRaw = String(formData.get("postingFinancialYear") ?? "").trim();
  const postingFMRaw = String(formData.get("postingFinancialMonth") ?? "").trim();
  const postingFY = Number.parseInt(postingFYRaw, 10);
  const postingFM = Number.parseInt(postingFMRaw, 10);

  if (!Number.isFinite(postingFY) || !Number.isFinite(postingFM)) {
    return {
      ok: false,
      error:
        "Working financial period is missing. Set your working month under Financial years before saving.",
    };
  }

  try {
    const [settings, openPeriod] = await Promise.all([
      getOrInitCompanySettings(),
      getOpenFinancialYearPeriod(),
    ]);
    assertPostingPeriod(openPeriod, postingFY, postingFM);
    const financialYear = postingFY;
    const financialMonth = postingFM;

    if (idRaw) {
      const id = Number.parseInt(idRaw, 10);
      if (!Number.isFinite(id)) return { ok: false, error: "Invalid order." };

      const existing = await prisma.deliveryOrder.findUnique({
        where: { id },
        select: { status: true, createdByUserId: true },
      });
      if (!existing) return { ok: false, error: "Order not found." };
      if (existing.status === ValidationStatus.VALIDATED) {
        return { ok: false, error: "Validated delivery orders cannot be edited." };
      }

      await prisma.deliveryOrder.update({
        where: { id },
        data: {
          customerId,
          dateIssued,
          orderRef,
          referenceNumber,
          salesPointId,
          financialYear,
          financialMonth,
          createdByUserId: existing.createdByUserId ?? createdByUserId,
        },
      });

      const row = await prisma.deliveryOrder.findUnique({
        where: { id },
        select: { id: true, deliveryOrderNo: true },
      });
      if (!row) return { ok: false, error: "Order not found." };

      revalidateOrderPaths(row.id);
      return { ok: true, id: row.id, deliveryOrderNo: row.deliveryOrderNo };
    }

    const deliveryOrderNo = await allocateDeliveryOrderNo(dateIssued);
    const created = await prisma.deliveryOrder.create({
      data: {
        deliveryOrderNo,
        dateIssued,
        customerId,
        orderRef,
        referenceNumber,
        salesPointId,
        financialYear,
        financialMonth,
        createdByUserId,
        status: ValidationStatus.PENDING,
      },
      select: { id: true, deliveryOrderNo: true },
    });

    revalidateOrderPaths(created.id);
    return { ok: true, id: created.id, deliveryOrderNo: created.deliveryOrderNo };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not save delivery order header.";
    return { ok: false, error: msg };
  }
}

export async function saveDeliveryOrderDetails(formData: FormData): Promise<SaveSectionResult> {
  const prisma = getPrismaClient();
  const deliveryOrderId = Number.parseInt(String(formData.get("deliveryOrderId") ?? ""), 10);
  if (!Number.isFinite(deliveryOrderId)) {
    return { ok: false, error: "Save the delivery order header first." };
  }

  let lines: LineInput[];
  try {
    lines = JSON.parse(String(formData.get("lines") ?? "[]")) as LineInput[];
  } catch {
    return { ok: false, error: "Invalid line data." };
  }

  if (!Array.isArray(lines) || lines.length === 0) {
    return { ok: false, error: "Add at least one line item." };
  }

  try {
    const order = await prisma.deliveryOrder.findUnique({
      where: { id: deliveryOrderId },
      include: { customer: { include: { taxRegime: true } } },
    });
    if (!order) return { ok: false, error: "Order not found." };

    const settings = await getOrInitCompanySettings();
    const companyVatRate = settings.vatRate;
    const vatApplies = order.customer.taxRegime.vatApplies;
    const appliedVatRate = vatApplies ? companyVatRate : new Prisma.Decimal(0);

    const prepared = lines.map((l) => {
      const productId = Number.parseInt(l.productId, 10);
      if (!Number.isFinite(productId)) throw new Error("Invalid product on a line.");

      const orderQty = Number.parseInt(l.orderQty, 10);
      if (!Number.isFinite(orderQty) || orderQty <= 0) {
        throw new Error("Quantity must be a positive whole number.");
      }

      const orderUnit = String(l.orderUnit ?? "").trim() || null;
      const unitPriceRaw = String(l.unitPrice ?? "").trim();
      if (!unitPriceRaw) throw new Error("Unit price (ex VAT) is required on each line.");

      const unitPrice = money2(d(unitPriceRaw));
      const lineSubtotalExTax = money2(unitPrice.mul(d(orderQty)));
      const vatAmount = vatApplies
        ? money2(lineSubtotalExTax.mul(appliedVatRate))
        : money2(d(0));

      const otherTaxLabel = String(l.otherTaxLabel ?? "").trim() || null;
      const otherTaxRaw = String(l.otherTaxAmount ?? "").trim();
      const otherTaxAmount = otherTaxRaw ? money2(d(otherTaxRaw)) : money2(d(0));

      const amount = money2(lineSubtotalExTax.add(vatAmount).add(otherTaxAmount));

      return {
        productId,
        orderQty,
        orderUnit,
        unitPrice,
        lineSubtotalExTax,
        vatRate: appliedVatRate,
        vatAmount,
        otherTaxLabel,
        otherTaxAmount,
        amount,
      };
    });

    await prisma.$transaction(async (tx) => {
      await tx.deliveryOrderDetails.deleteMany({ where: { deliveryOrderId } });
      if (prepared.length > 0) {
        await tx.deliveryOrderDetails.createMany({
          data: prepared.map((p) => ({ ...p, deliveryOrderId })),
        });
      }
    });

    revalidateOrderPaths(deliveryOrderId);
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not save line items.";
    return { ok: false, error: msg };
  }
}

export async function saveDeliveryOrderPayments(formData: FormData): Promise<SaveSectionResult> {
  const prisma = getPrismaClient();
  const deliveryOrderId = Number.parseInt(String(formData.get("deliveryOrderId") ?? ""), 10);
  if (!Number.isFinite(deliveryOrderId)) {
    return { ok: false, error: "Save the delivery order header first." };
  }

  let payments: PaymentInput[];
  try {
    payments = JSON.parse(String(formData.get("payments") ?? "[]")) as PaymentInput[];
  } catch {
    return { ok: false, error: "Invalid payment data." };
  }

  try {
    const order = await prisma.deliveryOrder.findUnique({
      where: { id: deliveryOrderId },
      select: { id: true, dateIssued: true },
    });
    if (!order) return { ok: false, error: "Order not found." };

    const dateIssued = order.dateIssued;

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

    await prisma.$transaction(async (tx) => {
      await tx.deliveryOrderPaymentDetails.deleteMany({ where: { deliveryOrderId } });
      if (preparedPayments.length > 0) {
        await tx.deliveryOrderPaymentDetails.createMany({
          data: preparedPayments.map((p) => ({ ...p, deliveryOrderId })),
        });
      }
    });

    revalidateOrderPaths(deliveryOrderId);
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not save payments.";
    return { ok: false, error: msg };
  }
}

export async function deleteDeliveryOrder(formData: FormData) {
  const prisma = getPrismaClient();
  const id = Number.parseInt(String(formData.get("id") ?? ""), 10);
  if (!Number.isFinite(id)) throw new Error("Invalid delivery order.");

  const existing = await prisma.deliveryOrder.findUnique({ where: { id }, select: { status: true } });
  if (!existing) throw new Error("Delivery order not found.");
  if (existing.status === ValidationStatus.VALIDATED) {
    throw new Error("Validated delivery orders cannot be deleted.");
  }

  await prisma.deliveryOrder.delete({ where: { id } });

  revalidatePath("/delivery-orders");
  revalidatePath(`/delivery-orders/${id}`);
  revalidatePath("/dashboard");
}

export async function validateDeliveryOrder(formData: FormData): Promise<SaveSectionResult> {
  const prisma = getPrismaClient();
  const id = Number.parseInt(String(formData.get("id") ?? ""), 10);
  const validatorUserId = String(formData.get("validatorUserId") ?? "").trim();
  const validatorRole = String(formData.get("validatorRole") ?? "").trim() as UserRole;
  if (!Number.isFinite(id)) return { ok: false, error: "Invalid delivery order." };
  if (!validatorUserId) return { ok: false, error: "Logged-in user is required." };
  if (validatorRole !== UserRole.SUPERVISOR && validatorRole !== UserRole.MANAGER && validatorRole !== UserRole.ADMIN) {
    return { ok: false, error: "Only supervisor/manager/admin can validate a delivery order." };
  }

  const existing = await prisma.deliveryOrder.findUnique({ where: { id }, select: { status: true } });
  if (!existing) return { ok: false, error: "Order not found." };
  if (existing.status === ValidationStatus.VALIDATED) return { ok: true };

  await prisma.deliveryOrder.update({
    where: { id },
    data: { status: ValidationStatus.VALIDATED, validatedAt: new Date(), validatedByUserId: validatorUserId },
  });
  revalidateOrderPaths(id);
  return { ok: true };
}
