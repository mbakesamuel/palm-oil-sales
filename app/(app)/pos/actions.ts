"use server";

import { getPrismaClient } from "@/lib/prisma";
import { allocateInvoiceNo } from "@/lib/invoice";
import { assertPostingPeriod, getOpenFinancialYearPeriod } from "@/lib/financial-year";
import { getOrInitCompanySettings } from "@/lib/settings";
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
};

export type SaveSaleResult =
  | { ok: true; id: string; invoiceNo: string; soldAtIso: string }
  | { ok: false; error: string };

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
    paidAtIso: string;
  }>;
};

function d(value: string | number) {
  return new Prisma.Decimal(value);
}

function money2(value: Prisma.Decimal) {
  return value.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

export async function createSale(formData: FormData): Promise<SaveSaleResult> {
  const prisma = getPrismaClient();
  const soldAt = new Date();
  const customerId = String(formData.get("customerId") ?? "");
  const createdByUserId = String(formData.get("createdByUserId") ?? "").trim();
  const referenceNumber = String(formData.get("referenceNumber") ?? "").trim() || null;
  const salesPointRaw = String(formData.get("salesPointId") ?? "").trim();
  const salesPointId = salesPointRaw ? Number.parseInt(salesPointRaw, 10) : null;
  const linesJson = String(formData.get("lines") ?? "[]");
  const paymentsJson = String(formData.get("payments") ?? "[]");

  const lines = JSON.parse(linesJson) as PosLineInput[];
  const payments = JSON.parse(paymentsJson) as PosPaymentInput[];

  const postingFYRaw = String(formData.get("postingFinancialYear") ?? "").trim();
  const postingFMRaw = String(formData.get("postingFinancialMonth") ?? "").trim();
  const postingFY = Number.parseInt(postingFYRaw, 10);
  const postingFM = Number.parseInt(postingFMRaw, 10);

  if (!customerId) return { ok: false, error: "Customer is required." };
  if (!createdByUserId) return { ok: false, error: "Logged-in user is required." };
  if (salesPointRaw && !Number.isFinite(salesPointId)) {
    return { ok: false, error: "Invalid sales point." };
  }
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

  if (!Number.isFinite(postingFY) || !Number.isFinite(postingFM)) {
    return {
      ok: false,
      error:
        "Working financial period is missing. Set your working month under Financial years before posting.",
    };
  }
  try {
    assertPostingPeriod(openPeriod, postingFY, postingFM);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Invalid posting period." };
  }

  const vatRate = customer.taxRegime.vatApplies
    ? d(settings.vatRate as unknown as string)
    : d(0);

  let net = d(0);
  let preparedLines: Array<{
    productId: number;
    qtyKg: Prisma.Decimal;
    unitPricePerKg: Prisma.Decimal;
    costPerKgSnapshot: Prisma.Decimal;
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
        costPerKgSnapshot: d("0.00"),
        lineNet,
      };
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Invalid line items." };
  }

  const vat = money2(net.mul(vatRate));
  const gross = money2(net.add(vat));

  let paidTotal = d(0);
  let preparedPayments: Array<{ method: PaymentMethod; amount: Prisma.Decimal; chequeNo: string | null }> = [];
  try {
    preparedPayments = payments
      .filter((p) => d(p.amount).gt(0))
      .map((p) => {
        const amount = money2(d(p.amount));
        if (amount.lte(0)) throw new Error("Payment amount must be > 0.");

        const method = p.method === "CHEQUE" ? PaymentMethod.CHEQUE : PaymentMethod.CASH;
        const chequeNo = method === PaymentMethod.CHEQUE ? String(p.chequeNo ?? "").trim() : "";

        if (method === PaymentMethod.CHEQUE && !chequeNo) {
          throw new Error("Cheque number is required for cheque payments.");
        }

        paidTotal = paidTotal.add(amount);
        return { method, amount, chequeNo: chequeNo || null };
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
      createdByUserId,
      referenceNumber,
      salesPointId,
      status: ValidationStatus.PENDING,
      customerNameSnapshot: customer.name,
      taxRegimeId: customer.taxRegimeId,
      vatRateSnapshot: vatRate,
      netAmount: net,
      vatAmount: vat,
      grossAmount: gross,
      financialYear: postingFY,
      financialMonth: postingFM,
      lines: {
        create: preparedLines.map((l) => ({
          productId: l.productId,
          qtyKg: l.qtyKg,
          unitPricePerKg: l.unitPricePerKg,
          costPerKgSnapshot: l.costPerKgSnapshot,
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
      paidAtIso: p.paidAt.toISOString(),
    })),
  };
}

export async function deleteSale(formData: FormData) {
  const prisma = getPrismaClient();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) throw new Error("Invalid sale.");

  const existing = await prisma.sale.findUnique({
    where: { id },
    select: { invoiceNo: true, status: true },
  });
  if (!existing) throw new Error("Sale not found.");
  if (existing.status === ValidationStatus.VALIDATED) {
    throw new Error("Validated invoices cannot be deleted.");
  }

  await prisma.sale.delete({ where: { id } });
  revalidatePath("/pos");
  revalidatePath("/dashboard");
}

export async function validateSale(formData: FormData) {
  const prisma = getPrismaClient();
  const id = String(formData.get("id") ?? "").trim();
  const validatorUserId = String(formData.get("validatorUserId") ?? "").trim();
  const validatorRole = String(formData.get("validatorRole") ?? "").trim() as UserRole;
  if (!id) throw new Error("Invalid sale.");
  if (!validatorUserId) throw new Error("Logged-in user is required.");
  if (validatorRole !== UserRole.SUPERVISOR && validatorRole !== UserRole.MANAGER && validatorRole !== UserRole.ADMIN) {
    throw new Error("Only supervisor/manager/admin can validate a sale.");
  }

  const existing = await prisma.sale.findUnique({ where: { id }, select: { status: true } });
  if (!existing) throw new Error("Sale not found.");
  if (existing.status === ValidationStatus.VALIDATED) return;

  await prisma.sale.update({
    where: { id },
    data: {
      status: ValidationStatus.VALIDATED,
      validatedAt: new Date(),
      validatedByUserId: validatorUserId,
    },
  });

  revalidatePath("/pos");
  revalidatePath(`/sales/${id}`);
  revalidatePath("/dashboard");
}

