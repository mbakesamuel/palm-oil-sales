"use server";

import { assertPermissionKey } from "@/lib/access-control";
import { getPrismaClient } from "@/lib/prisma";
import { allocateDeliveryOrderNo } from "@/lib/delivery-order-no";
import {
  assertPostingPeriod,
  assertTransactionDateInWorkingMonth,
  getOpenFinancialYearPeriod,
  toOpenFinancialYearForPosting,
} from "@/lib/financial-year";
import { firstDayOfCalendarMonth, noonUtcFromIsoDate } from "@/lib/posting-calendar";
import { getOrInitCompanySettings } from "@/lib/settings";
import {
  combinedVatAndOtherRates,
} from "@/lib/tax/resolve";
import { resolveCommercialServiceForUserId } from "@/lib/commercial-service";
import { resolveTaxesForCustomer } from "@/lib/tax/resolve-customer";
import { resolveUnitPriceExTax } from "@/lib/pricing/resolve";
import {
  canCreateOrEditDeliveryOrderDraft,
  canValidateDeliveryOrder,
  roleSeesOnlyValidatedDeliveryOrders,
} from "@/lib/auth-roles";
import type { UserRole as AppUserRole } from "@/lib/domain";
import { getServerSession } from "@/lib/auth-server";
import {
  salesPointErrorForResource,
  salesPointErrorForSubmitted,
} from "@/lib/auth-sales-point-scope";
import type { DeliveryOrderPrintModel } from "@/components/DeliveryOrderPrint";
import { PaymentMethod, Prisma, ValidationStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";

function money2Print(value: Prisma.Decimal) {
  return value.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

function totalsFromDetailsForPrint(
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
          ? money2Print(d.unitPrice.mul(d.orderQty))
          : z;
    subEx = subEx.add(net);

    if (d.vatAmount != null) totVat = totVat.add(d.vatAmount);
    if (d.otherTaxAmount != null) totOther = totOther.add(d.otherTaxAmount);

    if (d.amount != null) {
      grand = grand.add(d.amount);
    } else {
      const v = d.vatAmount ?? z;
      const o = d.otherTaxAmount ?? z;
      grand = grand.add(money2Print(net.add(v).add(o)));
    }
  }

  return {
    subtotalExTax: money2Print(subEx).toString(),
    totalVat: money2Print(totVat).toString(),
    totalOtherTax: money2Print(totOther).toString(),
    grandTotal: money2Print(grand).toString(),
  };
}

export type SaveHeaderResult =
  | { ok: true; id: number; deliveryOrderNo: string }
  | { ok: false; error: string };

export type SaveSectionResult = { ok: true } | { ok: false; error: string };

export type LoadedDeliveryOrderView = {
  id: number;
  deliveryOrderNo: string;
  customerId: string;
  customerName: string;
  vatApplies: boolean;
  dateIssued: string;
  orderRef: string | null;
  salesPointId: number;
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
  postingCalendarYear: number | null;
};

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

async function requireActor(prisma: ReturnType<typeof getPrismaClient>) {
  const session = await getServerSession();
  if (!session?.userId) {
    throw new Error("Login required.");
  }
  const actor = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, role: true, salesPointId: true, isActive: true },
  });
  if (!actor?.isActive) throw new Error("Login required.");
  return { session, actor };
}

export type DeliveryOrderTaxPreview = {
  vatRate: string;
  vatPercentLabel: string;
  otherRate: string;
  otherPercentLabel: string;
  otherLabel: string | null;
};

export async function previewDeliveryOrderTaxes(
  customerId: string,
  dateIssuedIso: string,
): Promise<
  { ok: true; preview: DeliveryOrderTaxPreview } | { ok: false; error: string }
> {
  const prisma = getPrismaClient();
  try {
    await assertPermissionKey("route:/delivery-orders");
    await requireActor(prisma);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Login required." };
  }

  const cid = String(customerId ?? "").trim();
  if (!cid) return { ok: false, error: "Customer is required." };

  const iso = String(dateIssuedIso ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    return { ok: false, error: "Date issued must be YYYY-MM-DD." };
  }

  const soldAt = new Date(`${iso}T12:00:00.000Z`);
  const customer = await prisma.customer.findUnique({
    where: { id: cid },
    select: { id: true },
  });
  if (!customer) return { ok: false, error: "Customer not found." };

  const resolved = await resolveTaxesForCustomer(prisma, customer.id, soldAt);
  if (!resolved.ok) return { ok: false, error: resolved.error };

  const c = combinedVatAndOtherRates(resolved.taxes);
  const pct = (n: Prisma.Decimal) =>
    new Prisma.Decimal(n.toString()).mul(100).toDecimalPlaces(2).toString();

  return {
    ok: true,
    preview: {
      vatRate: c.vatRate.toString(),
      vatPercentLabel: pct(c.vatRate),
      otherRate: c.otherRate.toString(),
      otherPercentLabel: pct(c.otherRate),
      otherLabel: c.otherLabel,
    },
  };
}

function revalidateOrderPaths(id: number) {
  revalidatePath("/delivery-orders");
  revalidatePath(`/delivery-orders/${id}`);
  revalidatePath("/dashboard");
  revalidatePath("/reports/stock-vs-commitments");
  revalidatePath("/reports/do-commitment-crosstab");
  revalidatePath("/reports/customer-delivery-monitor");
  revalidatePath("/reports/delivery-orders");
  revalidatePath("/reports/delivery-order-monitor");
}

export async function loadDeliveryOrderByNo(rawNo: string): Promise<LoadedDeliveryOrderView | null> {
  const deliveryOrderNo = String(rawNo ?? "").trim();
  if (!deliveryOrderNo) return null;

  const prisma = getPrismaClient();
  let actor;
  try {
    await assertPermissionKey("route:/delivery-orders");
    ({ actor } = await requireActor(prisma));
  } catch {
    return null;
  }

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

  const accessErr = salesPointErrorForResource(actor, order.salesPointId);
  if (accessErr) return null;

  if (
    roleSeesOnlyValidatedDeliveryOrders(actor.role as AppUserRole) &&
    order.status !== ValidationStatus.VALIDATED
  ) {
    return null;
  }

  return {
    id: order.id,
    deliveryOrderNo: order.deliveryOrderNo,
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
    postingCalendarYear: order.postingCalendarYear,
  };
}

export async function saveDeliveryOrderHeader(formData: FormData): Promise<SaveHeaderResult> {
  const prisma = getPrismaClient();
  const idRaw = String(formData.get("id") ?? "").trim();
  const customerId = String(formData.get("customerId") ?? "").trim();
  const dateIssuedRaw = String(formData.get("dateIssued") ?? "").trim();
  const orderRef = String(formData.get("orderRef") ?? "").trim() || null;
  const salesPointRaw = String(formData.get("salesPointId") ?? "").trim();
  const salesPointId = Number.parseInt(salesPointRaw, 10);
  if (!salesPointRaw || !Number.isFinite(salesPointId)) {
    return { ok: false, error: "Collection point (sales point) is required." };
  }

  if (!customerId) return { ok: false, error: "Customer is required." };

  let session: Awaited<ReturnType<typeof requireActor>>["session"];
  let actor: Awaited<ReturnType<typeof requireActor>>["actor"];
  try {
    await assertPermissionKey("route:/delivery-orders");
    ({ session, actor } = await requireActor(prisma));
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Login required." };
  }

  const effectiveSalesPointId = session.salesPoint?.id ?? salesPointId;
  const spSubmitErr = salesPointErrorForSubmitted(actor, effectiveSalesPointId);
  if (spSubmitErr) return { ok: false, error: spSubmitErr };

  if (!canCreateOrEditDeliveryOrderDraft(session.role)) {
    return {
      ok: false,
      error:
        "Only senior sales supervisors can create or edit delivery order drafts. Managers validate pending orders once they are ready.",
    };
  }

  const postingFYRaw = String(formData.get("postingFinancialYear") ?? "").trim();
  const postingCYRaw = String(formData.get("postingCalendarYear") ?? "").trim();
  const postingCMRaw = String(formData.get("postingCalendarMonth") ?? "").trim();
  const postingFY = Number.parseInt(postingFYRaw, 10);
  const postingCalendarYear = Number.parseInt(postingCYRaw, 10);
  const postingCalendarMonth = Number.parseInt(postingCMRaw, 10);

  if (!Number.isFinite(postingFY) || !Number.isFinite(postingCalendarYear) || !Number.isFinite(postingCalendarMonth)) {
    return {
      ok: false,
      error:
        "Working financial period is missing. Set your working month under Financial years before saving.",
    };
  }

  const dateIssued = dateIssuedRaw
    ? new Date(`${dateIssuedRaw}T12:00:00.000Z`)
    : noonUtcFromIsoDate(
        firstDayOfCalendarMonth(postingCalendarYear, postingCalendarMonth),
      );
  if (Number.isNaN(dateIssued.getTime())) return { ok: false, error: "Invalid date." };

  try {
    const openPeriod = await getOpenFinancialYearPeriod();
    if (!openPeriod) {
      return { ok: false, error: "No financial year is open." };
    }
    const open = toOpenFinancialYearForPosting(openPeriod);
    assertPostingPeriod(open, postingFY, postingCalendarYear, postingCalendarMonth);
    assertTransactionDateInWorkingMonth(open, dateIssued, postingCalendarYear, postingCalendarMonth);
    const financialYear = postingFY;
    const financialMonth = postingCalendarMonth;

    const commercialService = await resolveCommercialServiceForUserId(prisma, session.userId);

    if (idRaw) {
      const id = Number.parseInt(idRaw, 10);
      if (!Number.isFinite(id)) return { ok: false, error: "Invalid order." };

      const existing = await prisma.deliveryOrder.findUnique({
        where: { id },
        select: { status: true, createdByUserId: true, salesPointId: true },
      });
      if (!existing) return { ok: false, error: "Order not found." };
      if (existing.status === ValidationStatus.VALIDATED) {
        return { ok: false, error: "Validated delivery orders cannot be edited." };
      }
      const accessErr = salesPointErrorForResource(actor, existing.salesPointId);
      if (accessErr) return { ok: false, error: accessErr };

      await prisma.deliveryOrder.update({
        where: { id },
        data: {
          customerId,
          dateIssued,
          orderRef,
          salesPointId: effectiveSalesPointId,
          financialYear,
          financialMonth,
          postingCalendarYear,
          createdByUserId: existing.createdByUserId ?? session.userId,
          commercialServiceId: commercialService.id,
          issuerPhoneSnapshot: commercialService.phone ?? null,
          issuerAddressSnapshot: commercialService.address ?? null,
          commercialServiceNameSnapshot: commercialService.name,
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
        salesPointId: effectiveSalesPointId,
        financialYear,
        financialMonth,
        postingCalendarYear,
        createdByUserId: session.userId,
        status: ValidationStatus.PENDING,
        commercialServiceId: commercialService.id,
        issuerPhoneSnapshot: commercialService.phone ?? null,
        issuerAddressSnapshot: commercialService.address ?? null,
        commercialServiceNameSnapshot: commercialService.name,
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
  let actor: Awaited<ReturnType<typeof requireActor>>["actor"];
  try {
    await assertPermissionKey("route:/delivery-orders");
    ({ actor } = await requireActor(prisma));
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Login required." };
  }

  if (!canCreateOrEditDeliveryOrderDraft(actor.role)) {
    return {
      ok: false,
      error:
        "Only senior sales supervisors can edit line items on a delivery order draft.",
    };
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
      select: { customerId: true, status: true, salesPointId: true, dateIssued: true },
    });
    if (!order) return { ok: false, error: "Order not found." };
    if (order.status === ValidationStatus.VALIDATED) {
      return { ok: false, error: "Validated delivery orders cannot be edited." };
    }
    const accessErr = salesPointErrorForResource(actor, order.salesPointId);
    if (accessErr) return { ok: false, error: accessErr };

    const [resolvedTaxes, customer] = await Promise.all([
      resolveTaxesForCustomer(prisma, order.customerId, order.dateIssued),
      prisma.customer.findUnique({
        where: { id: order.customerId },
        select: { customerType: true },
      }),
    ]);
    if (!resolvedTaxes.ok) return { ok: false, error: resolvedTaxes.error };
    if (!customer) return { ok: false, error: "Customer not found." };
    const comb = combinedVatAndOtherRates(resolvedTaxes.taxes);

    const prepared: Array<{
      productId: number;
      orderQty: number;
      orderUnit: string | null;
      unitPrice: Prisma.Decimal;
      lineSubtotalExTax: Prisma.Decimal;
      vatRate: Prisma.Decimal;
      vatAmount: Prisma.Decimal;
      otherTaxLabel: string | null;
      otherTaxAmount: Prisma.Decimal;
      amount: Prisma.Decimal;
    }> = [];

    for (const l of lines) {
      const productId = Number.parseInt(l.productId, 10);
      if (!Number.isFinite(productId)) throw new Error("Invalid product on a line.");

      const orderQty = Number.parseInt(l.orderQty, 10);
      if (!Number.isFinite(orderQty) || orderQty <= 0) {
        throw new Error("Quantity must be a positive whole number.");
      }

      const orderUnit = String(l.orderUnit ?? "").trim() || null;
      const priced = await resolveUnitPriceExTax(
        prisma,
        productId,
        customer.customerType,
        order.dateIssued,
      );
      if (!priced.ok) throw new Error(priced.error);

      const unitPrice = money2(priced.unitPriceExTax);
      const lineSubtotalExTax = money2(unitPrice.mul(d(orderQty)));
      const vatAmount = money2(lineSubtotalExTax.mul(comb.vatRate));
      const otherTaxAmount = money2(lineSubtotalExTax.mul(comb.otherRate));
      const otherTaxLabel = comb.otherLabel;

      const amount = money2(lineSubtotalExTax.add(vatAmount).add(otherTaxAmount));

      prepared.push({
        productId,
        orderQty,
        orderUnit,
        unitPrice,
        lineSubtotalExTax,
        vatRate: comb.vatRate,
        vatAmount,
        otherTaxLabel,
        otherTaxAmount,
        amount,
      });
    }

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
  let actor: Awaited<ReturnType<typeof requireActor>>["actor"];
  try {
    await assertPermissionKey("route:/delivery-orders");
    ({ actor } = await requireActor(prisma));
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Login required." };
  }

  if (!canCreateOrEditDeliveryOrderDraft(actor.role)) {
    return {
      ok: false,
      error: "Only senior sales supervisors can edit payments on a delivery order draft.",
    };
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
      select: { id: true, dateIssued: true, salesPointId: true, status: true },
    });
    if (!order) return { ok: false, error: "Order not found." };
    if (order.status === ValidationStatus.VALIDATED) {
      return { ok: false, error: "Validated delivery orders cannot be edited." };
    }
    const accessErr = salesPointErrorForResource(actor, order.salesPointId);
    if (accessErr) return { ok: false, error: accessErr };

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

export async function deleteDeliveryOrder(formData: FormData): Promise<SaveSectionResult> {
  const prisma = getPrismaClient();
  const id = Number.parseInt(String(formData.get("id") ?? ""), 10);
  if (!Number.isFinite(id)) return { ok: false, error: "Invalid delivery order." };

  let actor: Awaited<ReturnType<typeof requireActor>>["actor"];
  try {
    await assertPermissionKey("route:/delivery-orders");
    ({ actor } = await requireActor(prisma));
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Login required." };
  }

  const existing = await prisma.deliveryOrder.findUnique({
    where: { id },
    select: { status: true, salesPointId: true },
  });
  if (!existing) return { ok: false, error: "Delivery order not found." };
  const accessErr = salesPointErrorForResource(actor, existing.salesPointId);
  if (accessErr) return { ok: false, error: accessErr };
  if (existing.status === ValidationStatus.VALIDATED) {
    return { ok: false, error: "Validated delivery orders cannot be deleted." };
  }
  if (!canCreateOrEditDeliveryOrderDraft(actor.role)) {
    return {
      ok: false,
      error: "Only senior sales supervisors can delete a pending delivery order.",
    };
  }

  await prisma.deliveryOrder.delete({ where: { id } });

  revalidateOrderPaths(id);
  return { ok: true };
}

export async function validateDeliveryOrder(formData: FormData): Promise<SaveSectionResult> {
  const prisma = getPrismaClient();
  const id = Number.parseInt(String(formData.get("id") ?? ""), 10);
  if (!Number.isFinite(id)) return { ok: false, error: "Invalid delivery order." };
  let session: Awaited<ReturnType<typeof requireActor>>["session"];
  let actor: Awaited<ReturnType<typeof requireActor>>["actor"];
  try {
    await assertPermissionKey("route:/delivery-orders");
    ({ session, actor } = await requireActor(prisma));
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Login required." };
  }
  if (!canValidateDeliveryOrder(session.role)) {
    return {
      ok: false,
      error: "Only managers can validate a delivery order.",
    };
  }

  const existing = await prisma.deliveryOrder.findUnique({
    where: { id },
    select: { status: true, salesPointId: true },
  });
  if (!existing) return { ok: false, error: "Order not found." };
  const accessErr = salesPointErrorForResource(actor, existing.salesPointId);
  if (accessErr) return { ok: false, error: accessErr };
  if (existing.status === ValidationStatus.VALIDATED) return { ok: true };

  await prisma.deliveryOrder.update({
    where: { id },
    data: { status: ValidationStatus.VALIDATED, validatedAt: new Date(), validatedByUserId: session.userId },
  });
  revalidateOrderPaths(id);
  return { ok: true };
}

export type DeliveryOrderPrintPayload = {
  companyName: string;
  department: string | null;
  companyPhone: string | null;
  companyAddress: string | null;
  logoSrc: string;
  order: DeliveryOrderPrintModel;
};

export async function loadDeliveryOrderPrintById(
  id: number,
): Promise<
  { ok: true; data: DeliveryOrderPrintPayload } | { ok: false; reason: "auth" | "missing" }
> {
  const prisma = getPrismaClient();
  let actor;
  let settings;
  try {
    await assertPermissionKey("route:/delivery-orders");
    const r = await requireActor(prisma);
    actor = r.actor;
    settings = await getOrInitCompanySettings();
  } catch {
    return { ok: false, reason: "auth" };
  }

  const order = await prisma.deliveryOrder.findUnique({
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
  });
  if (!order) return { ok: false, reason: "missing" };

  if (salesPointErrorForResource(actor, order.salesPointId)) {
    return { ok: false, reason: "missing" };
  }

  if (
    roleSeesOnlyValidatedDeliveryOrders(actor.role as AppUserRole) &&
    order.status !== ValidationStatus.VALIDATED
  ) {
    return { ok: false, reason: "missing" };
  }

  const t = totalsFromDetailsForPrint(order.details);
  const orderModel: DeliveryOrderPrintModel = {
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

  const logoSrc =
    settings.logoUrl && settings.logoUrl.trim() !== ""
      ? settings.logoUrl.trim()
      : "/cdc-logo-svg.svg";

  const deptParts = [settings.department?.trim(), order.commercialServiceNameSnapshot?.trim()].filter(
    (s): s is string => Boolean(s && s.length > 0),
  );

  return {
    ok: true,
    data: {
      companyName: settings.companyName,
      department: deptParts.length > 0 ? deptParts.join(" · ") : null,
      companyPhone: order.issuerPhoneSnapshot ?? null,
      companyAddress: order.issuerAddressSnapshot ?? null,
      logoSrc,
      order: orderModel,
    },
  };
}
