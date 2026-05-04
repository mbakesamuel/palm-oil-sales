"use server";

import { getPrismaClient } from "@/lib/prisma";
import { allocateInvoiceNo } from "@/lib/invoice";
import {
  assertPostingPeriod,
  assertTransactionDateInWorkingMonth,
  getOpenFinancialYearPeriod,
  toOpenFinancialYearForPosting,
} from "@/lib/financial-year";
import { noonUtcFromIsoDate, normalizeIsoDateInput, utcIsoDateToday } from "@/lib/posting-calendar";
import { getOrInitCompanySettings } from "@/lib/settings";
import {
  loadDeliveryOrderControl,
  toDeliveryOrderLookupDto,
  validateSaleAgainstDeliveryOrder,
  type DeliveryOrderLookupDto,
} from "@/lib/delivery-order-sale-control";
import { assertPermissionKey } from "@/lib/access-control";
import { canValidateDocuments } from "@/lib/auth-roles";
import { getServerSession } from "@/lib/auth-server";
import {
  salesPointErrorForResource,
  salesPointErrorForSubmitted,
} from "@/lib/auth-sales-point-scope";
import { applyFefoStockDeduction, StockInsufficientError } from "@/lib/stock-fefo";
import type { SalePrintModel } from "@/components/SalePrint";
import { PaymentMethod, Prisma, ValidationStatus, UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";

type PosLineInput = {
  productId: string;
  qtyKg: string;
  unitPricePerKg: string;
};

type PosPaymentInput = {
  method: "CASH" | "CHEQUE";
  amount: string;
  chequeNo?: string;
  bank?: string;
};

export type SaveSaleResult =
  | { ok: true; id: string; invoiceNo: string; soldAtIso: string }
  | { ok: false; error: string };

export type SaleMutationResult = { ok: true } | { ok: false; error: string };

export type LoadedSaleView = {
  id: string;
  invoiceNo: string;
  soldAtIso: string;
  referenceNumber: string | null;
  salesPointId: number | null;
  salesPointName: string | null;
  customerId: string;
  customerName: string;
  taxpayerId: string | null;
  vatApplies: boolean;
  createdByUserId: string;
  createdByName: string;
  status: ValidationStatus;
  validatedAtIso: string | null;
  validatedByUserId: string | null;
  validatedByName: string | null;
  financialYear: number | null;
  financialMonth: number | null;
  postingCalendarYear: number | null;
  vehicleNumber: string;
  dateIssuedIso: string;
  deliveryOrderNo: string | null;
  netAmount: string;
  vatAmount: string;
  grossAmount: string;
  lines: Array<{
    productId: number;
    productName: string;
    productCat: string;
    qtyKg: string;
    unitPricePerKg: string;
    lineNet: string;
    lineVat: string;
    lineGross: string;
  }>;
  payments: Array<{
    method: PaymentMethod;
    amount: string;
    chequeNo: string | null;
    bank: string | null;
    paidAtIso: string;
  }>;
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
  if (!actor?.isActive) {
    throw new Error("Login required.");
  }
  return { session, actor };
}

export async function createSale(formData: FormData): Promise<SaveSaleResult> {
  const prisma = getPrismaClient();
  const customerId = String(formData.get("customerId") ?? "");
  const referenceNumber = String(formData.get("referenceNumber") ?? "").trim() || null;
  const salesPointRaw = String(formData.get("salesPointId") ?? "").trim();
  const salesPointId = salesPointRaw ? Number.parseInt(salesPointRaw, 10) : null;
  const linesJson = String(formData.get("lines") ?? "[]");
  const paymentsJson = String(formData.get("payments") ?? "[]");

  const lines = JSON.parse(linesJson) as PosLineInput[];
  const payments = JSON.parse(paymentsJson) as PosPaymentInput[];
  const vehicleNumber = String(formData.get("vehicleNumber") ?? "").trim();
  const deliveryOrderNoRaw = String(formData.get("deliveryOrderNo") ?? "").trim();
  const deliveryOrderNo = deliveryOrderNoRaw || null;

  const postingFYRaw = String(formData.get("postingFinancialYear") ?? "").trim();
  const postingCYRaw = String(formData.get("postingCalendarYear") ?? "").trim();
  const postingCMRaw = String(formData.get("postingCalendarMonth") ?? "").trim();
  const postingFY = Number.parseInt(postingFYRaw, 10);
  const postingCalendarYear = Number.parseInt(postingCYRaw, 10);
  const postingCalendarMonth = Number.parseInt(postingCMRaw, 10);

  const transactionDateRaw = String(formData.get("transactionDate") ?? "").trim();
  const transactionIso = normalizeIsoDateInput(transactionDateRaw) ?? utcIsoDateToday();
  const soldAt = noonUtcFromIsoDate(transactionIso);

  if (!customerId) return { ok: false, error: "Customer is required." };
  if (!vehicleNumber) return { ok: false, error: "Vehicle number is required." };
  if (salesPointRaw && !Number.isFinite(salesPointId)) {
    return { ok: false, error: "Invalid sales point." };
  }

  let session: Awaited<ReturnType<typeof requireActor>>["session"];
  let actor: Awaited<ReturnType<typeof requireActor>>["actor"];
  try {
    await assertPermissionKey("route:/pos");
    ({ session, actor } = await requireActor(prisma));
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Login required." };
  }

  const effectiveSalesPointId = session.salesPoint?.id ?? salesPointId;
  const spErr = salesPointErrorForSubmitted(actor, effectiveSalesPointId);
  if (spErr) return { ok: false, error: spErr };
  if (!Array.isArray(lines) || lines.length === 0) return { ok: false, error: "Add at least one line." };
  if (!Array.isArray(payments) || payments.length === 0)
    return { ok: false, error: "Add at least one payment." };

  const [settings, customer, openPeriod] = await Promise.all([
    getOrInitCompanySettings(),
    prisma.customer.findUnique({
      where: { id: customerId },
      select: {
        id: true,
        name: true,
        taxpayerId: true,
        taxRegimeId: true,
        taxRegime: { select: { vatApplies: true } },
      },
    }),
    getOpenFinancialYearPeriod(),
  ]);

  if (!customer) return { ok: false, error: "Customer not found." };

  if (!Number.isFinite(postingFY) || !Number.isFinite(postingCalendarYear) || !Number.isFinite(postingCalendarMonth)) {
    return {
      ok: false,
      error:
        "Working financial period is missing. Set your working month under Financial years before posting.",
    };
  }
  if (!openPeriod) {
    return { ok: false, error: "No financial year is open." };
  }
  const open = toOpenFinancialYearForPosting(openPeriod);
  try {
    assertPostingPeriod(open, postingFY, postingCalendarYear, postingCalendarMonth);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Invalid posting period." };
  }
  try {
    assertTransactionDateInWorkingMonth(open, soldAt, postingCalendarYear, postingCalendarMonth);
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Transaction date is outside the working month.",
    };
  }

  const vatRate = customer.taxRegime.vatApplies
    ? d(settings.vatRate as unknown as string)
    : d(0);

  let net = d(0);
  let preparedLines: Array<{
    productId: number;
    qtyKg: Prisma.Decimal;
    unitPricePerKg: Prisma.Decimal;
    lineNet: Prisma.Decimal;
  }> = [];
  try {
    preparedLines = lines.map((l) => {
      if (!l.productId) throw new Error("Each line must have a product.");
      const productId = Number.parseInt(l.productId, 10);
      if (!Number.isFinite(productId)) throw new Error("Invalid product selected.");
      const qty = d(l.qtyKg);
      const price = d(l.unitPricePerKg);
      if (qty.lte(0)) throw new Error("Qty must be > 0.");
      if (price.lt(0)) throw new Error("Unit price must be >= 0.");
      const lineNet = money2(qty.mul(price));
      net = net.add(lineNet);

      return {
        productId,
        qtyKg: qty,
        unitPricePerKg: price,
        lineNet,
      };
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Invalid line items." };
  }

  if (deliveryOrderNo) {
    const productRows = await prisma.product.findMany({
      where: { productId: { in: [...new Set(preparedLines.map((l) => l.productId))] } },
      select: { productId: true, productName: true },
    });
    const nameById = new Map(productRows.map((p) => [p.productId, p.productName]));
    const check = await validateSaleAgainstDeliveryOrder({
      deliveryOrderNo,
      customerId,
      lines: preparedLines.map((l) => ({
        productId: l.productId,
        productName: nameById.get(l.productId) ?? `Product ${l.productId}`,
        qtyKg: l.qtyKg,
      })),
    });
    if (!check.ok) return { ok: false, error: check.error };
  }

  const vat = money2(net.mul(vatRate));
  const gross = money2(net.add(vat));

  let paidTotal = d(0);
  let preparedPayments: Array<{
    method: PaymentMethod;
    amount: Prisma.Decimal;
    chequeNo: string | null;
    bank: string | null;
  }> = [];
  try {
    preparedPayments = payments
      .filter((p) => d(p.amount).gt(0))
      .map((p) => {
        const amount = money2(d(p.amount));
        if (amount.lte(0)) throw new Error("Payment amount must be > 0.");

        const method = p.method === "CHEQUE" ? PaymentMethod.CHEQUE : PaymentMethod.CASH;
        const chequeNo = method === PaymentMethod.CHEQUE ? String(p.chequeNo ?? "").trim() : "";
        const bankRaw = method === PaymentMethod.CHEQUE ? String(p.bank ?? "").trim() : "";
        const bank = bankRaw ? bankRaw : null;

        if (method === PaymentMethod.CHEQUE && !chequeNo) {
          throw new Error("Cheque number is required for cheque payments.");
        }

        paidTotal = paidTotal.add(amount);
        return { method, amount, chequeNo: chequeNo || null, bank };
      });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Invalid payments." };
  }

  if (preparedPayments.length === 0) return { ok: false, error: "Payment amount must be > 0." };
  if (!paidTotal.equals(gross)) {
    return { ok: false, error: "No credit sales: payment total must equal gross amount." };
  }

  const invoiceNo = await allocateInvoiceNo(settings.invoicePrefix, soldAt);

  const created = await prisma.sale.create({
    data: {
      invoiceNo,
      soldAt,
      customerId: customer.id,
      createdByUserId: session.userId,
      referenceNumber,
      salesPointId: effectiveSalesPointId,
      vehicleNumber,
      dateIssued: soldAt,
      deliveryOrderNo,
      status: ValidationStatus.PENDING,
      customerNameSnapshot: customer.name,
      taxRegimeId: customer.taxRegimeId,
      vatRateSnapshot: vatRate,
      netAmount: net,
      vatAmount: vat,
      grossAmount: gross,
      financialYear: postingFY,
      financialMonth: postingCalendarMonth,
      postingCalendarYear,
      lines: {
        create: preparedLines.map((l) => ({
          productId: l.productId,
          qtyKg: l.qtyKg,
          unitPricePerKg: l.unitPricePerKg,
          lineNet: l.lineNet,
          lineVat: money2(l.lineNet.mul(vatRate)),
          lineGross: money2(l.lineNet.add(money2(l.lineNet.mul(vatRate)))),
        })),
      },
      payments: {
        create: preparedPayments.map((p) => ({
          method: p.method,
          amount: p.amount,
          chequeNo: p.chequeNo,
          bank: p.bank,
          paidAt: soldAt,
        })),
      },
    },
    select: { id: true, invoiceNo: true, soldAt: true },
  });

  revalidatePath("/pos");
  revalidatePath("/dashboard");

  return { ok: true, id: created.id, invoiceNo: created.invoiceNo, soldAtIso: created.soldAt.toISOString() };
}

export async function loadSaleByInvoiceNo(rawNo: string): Promise<LoadedSaleView | null> {
  const invoiceNo = String(rawNo ?? "").trim();
  if (!invoiceNo) return null;

  const prisma = getPrismaClient();
  let actor;
  try {
    await assertPermissionKey("route:/pos");
    ({ actor } = await requireActor(prisma));
  } catch {
    return null;
  }

  const row = await prisma.sale.findUnique({
    where: { invoiceNo },
    include: {
      customer: { select: { id: true, name: true, taxpayerId: true, taxRegime: { select: { vatApplies: true } } } },
      createdBy: { select: { id: true, name: true } },
      validatedBy: { select: { id: true, name: true } },
      salesPoint: { select: { id: true, name: true } },
      lines: { include: { product: { select: { productName: true, productCat: { select: { productCat: true } } } } }, orderBy: { id: "asc" } },
      payments: { orderBy: { id: "asc" } },
    },
  });
  if (!row) return null;

  const accessErr = salesPointErrorForResource(actor, row.salesPointId ?? null);
  if (accessErr) return null;

  return {
    id: row.id,
    invoiceNo: row.invoiceNo,
    soldAtIso: row.soldAt.toISOString(),
    referenceNumber: row.referenceNumber ?? null,
    salesPointId: row.salesPointId ?? null,
    salesPointName: row.salesPoint?.name ?? null,
    customerId: row.customerId,
    customerName: row.customer.name,
    taxpayerId: row.customer.taxpayerId,
    vatApplies: row.customer.taxRegime.vatApplies,
    createdByUserId: row.createdByUserId,
    createdByName: row.createdBy.name,
    status: row.status,
    validatedAtIso: row.validatedAt ? row.validatedAt.toISOString() : null,
    validatedByUserId: row.validatedByUserId ?? null,
    validatedByName: row.validatedBy?.name ?? null,
    financialYear: row.financialYear,
    financialMonth: row.financialMonth,
    postingCalendarYear: row.postingCalendarYear,
    vehicleNumber: row.vehicleNumber,
    dateIssuedIso: (row.dateIssued ?? row.soldAt).toISOString(),
    deliveryOrderNo: row.deliveryOrderNo ?? null,
    netAmount: row.netAmount.toString(),
    vatAmount: row.vatAmount.toString(),
    grossAmount: row.grossAmount.toString(),
    lines: row.lines.map((l) => ({
      productId: l.productId,
      productName: l.product.productName,
      productCat: l.product.productCat.productCat,
      qtyKg: l.qtyKg.toString(),
      unitPricePerKg: l.unitPricePerKg.toString(),
      lineNet: l.lineNet.toString(),
      lineVat: l.lineVat.toString(),
      lineGross: l.lineGross.toString(),
    })),
    payments: row.payments.map((p) => ({
      method: p.method,
      amount: p.amount.toString(),
      chequeNo: p.chequeNo ?? null,
      bank: p.bank ?? null,
      paidAtIso: p.paidAt.toISOString(),
    })),
  };
}

export async function lookupDeliveryOrderForSale(
  rawNo: string,
  selectedCustomerId: string,
): Promise<
  | { ok: true; data: DeliveryOrderLookupDto & { customerMatches: boolean } }
  | { ok: false; error: string }
> {
  const deliveryOrderNo = String(rawNo ?? "").trim();
  if (!deliveryOrderNo) {
    return { ok: false, error: "Enter a delivery order number." };
  }
  const prisma = getPrismaClient();
  let actor: Awaited<ReturnType<typeof requireActor>>["actor"];
  try {
    await assertPermissionKey("route:/pos");
    ({ actor } = await requireActor(prisma));
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Login required." };
  }

  const ctx = await loadDeliveryOrderControl(deliveryOrderNo);
  if (!ctx) {
    return { ok: false, error: "No delivery order with that number." };
  }

  const orderSp = await prisma.deliveryOrder.findUnique({
    where: { deliveryOrderNo },
    select: { salesPointId: true },
  });
  const accessErr = salesPointErrorForResource(actor, orderSp?.salesPointId ?? null);
  if (accessErr) {
    return { ok: false, error: accessErr };
  }

  const data = toDeliveryOrderLookupDto(ctx);
  const customerMatches =
    !selectedCustomerId || selectedCustomerId === ctx.customerId;
  return { ok: true, data: { ...data, customerMatches } };
}

export async function deleteSale(formData: FormData): Promise<SaleMutationResult> {
  const prisma = getPrismaClient();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { ok: false, error: "Invalid sale." };

  let actor: Awaited<ReturnType<typeof requireActor>>["actor"];
  try {
    await assertPermissionKey("route:/pos");
    ({ actor } = await requireActor(prisma));
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Login required." };
  }

  const existing = await prisma.sale.findUnique({
    where: { id },
    select: { invoiceNo: true, status: true, salesPointId: true },
  });
  if (!existing) return { ok: false, error: "Sale not found." };
  const accessErr = salesPointErrorForResource(actor, existing.salesPointId ?? null);
  if (accessErr) return { ok: false, error: accessErr };
  if (existing.status === ValidationStatus.VALIDATED) {
    return { ok: false, error: "Validated invoices cannot be deleted." };
  }

  await prisma.sale.delete({ where: { id } });
  revalidatePath("/pos");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function validateSale(formData: FormData): Promise<SaleMutationResult> {
  const prisma = getPrismaClient();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { ok: false, error: "Invalid sale." };

  let session: Awaited<ReturnType<typeof requireActor>>["session"];
  let actor: Awaited<ReturnType<typeof requireActor>>["actor"];
  try {
    await assertPermissionKey("route:/pos");
    ({ session, actor } = await requireActor(prisma));
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Login required." };
  }

  const validatorRole = session.role as UserRole;
  if (!canValidateDocuments(validatorRole)) {
    return { ok: false, error: "Only authorized supervisors/managers can validate a sale." };
  }

  const existing = await prisma.sale.findUnique({
    where: { id },
    select: { status: true, salesPointId: true },
  });
  if (!existing) return { ok: false, error: "Sale not found." };
  const accessErr = salesPointErrorForResource(actor, existing.salesPointId ?? null);
  if (accessErr) return { ok: false, error: accessErr };
  if (existing.status === ValidationStatus.VALIDATED) return { ok: true };

  try {
    await prisma.$transaction(
      async (tx) => {
        const sale = await tx.sale.findUnique({
          where: { id },
          include: {
            lines: {
              include: { product: { select: { productName: true } } },
            },
          },
        });
        if (!sale) throw new Error("Sale not found.");
        if (sale.status === ValidationStatus.VALIDATED) return;
        if (sale.salesPointId == null) {
          throw new StockInsufficientError(
            "Cannot validate: this invoice has no sales point. Stock is tracked per collection point.",
          );
        }
        await applyFefoStockDeduction(tx, sale.salesPointId, sale.lines);
        await tx.sale.update({
          where: { id },
          data: {
            status: ValidationStatus.VALIDATED,
            validatedAt: new Date(),
            validatedByUserId: session.userId,
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (e) {
    if (e instanceof StockInsufficientError) {
      return { ok: false, error: e.message };
    }
    throw e;
  }

  revalidatePath("/pos");
  revalidatePath(`/sales/${id}`);
  revalidatePath("/dashboard");
  revalidatePath("/reports/stock-on-hand");
  revalidatePath("/reports/stock-vs-commitments");
  return { ok: true };
}

export type SalePrintPayload = {
  companyName: string;
  department: string | null;
  companyPhone: string | null;
  companyAddress: string | null;
  sale: SalePrintModel;
};

export async function loadSalePrintById(
  saleId: string,
): Promise<{ ok: true; data: SalePrintPayload } | { ok: false; reason: "auth" | "missing" }> {
  const sid = String(saleId ?? "").trim();
  if (!sid) return { ok: false, reason: "missing" };

  const prisma = getPrismaClient();
  let actor;
  let settings;
  try {
    await assertPermissionKey("route:/pos");
    const r = await requireActor(prisma);
    actor = r.actor;
    settings = await getOrInitCompanySettings();
  } catch {
    return { ok: false, reason: "auth" };
  }

  const sale = await prisma.sale.findUnique({
    where: { id: sid },
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
  });
  if (!sale) return { ok: false, reason: "missing" };

  if (salesPointErrorForResource(actor, sale.salesPointId ?? null)) {
    return { ok: false, reason: "missing" };
  }

  const saleModel: SalePrintModel = {
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
      bank: p.bank ?? null,
      paidAtIso: p.paidAt.toISOString(),
    })),
  };

  return {
    ok: true,
    data: {
      companyName: settings.companyName,
      department: settings.department ?? null,
      companyPhone: settings.phone ?? null,
      companyAddress: settings.address ?? null,
      sale: saleModel,
    },
  };
}
