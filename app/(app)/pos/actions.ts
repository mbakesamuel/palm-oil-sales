"use server";

import { getPrismaClient } from "@/lib/prisma";
import { allocateInvoiceNo } from "@/lib/invoice";
import { getOrInitCompanySettings } from "@/lib/settings";
import { PaymentMethod, Prisma } from "@prisma/client";
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

function d(value: string | number) {
  return new Prisma.Decimal(value);
}

function money2(value: Prisma.Decimal) {
  return value.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

export async function createSale(formData: FormData) {
  const prisma = getPrismaClient();
  const soldAt = new Date();
  const customerId = String(formData.get("customerId") ?? "");
  const createdByUserId = String(formData.get("createdByUserId") ?? "");
  const linesJson = String(formData.get("lines") ?? "[]");
  const paymentsJson = String(formData.get("payments") ?? "[]");

  const lines = JSON.parse(linesJson) as PosLineInput[];
  const payments = JSON.parse(paymentsJson) as PosPaymentInput[];

  if (!customerId) throw new Error("Customer is required.");
  if (!createdByUserId) throw new Error("Cashier is required.");
  if (!Array.isArray(lines) || lines.length === 0) throw new Error("Add at least one line.");
  if (!Array.isArray(payments) || payments.length === 0)
    throw new Error("Add at least one payment.");

  const [settings, customer] = await Promise.all([
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
  ]);

  if (!customer) throw new Error("Customer not found.");

  const vatRate = customer.taxRegime.vatApplies
    ? d(settings.vatRate as unknown as string)
    : d(0);

  let net = d(0);
  const preparedLines = lines.map((l) => {
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

  const vat = money2(net.mul(vatRate));
  const gross = money2(net.add(vat));

  let paidTotal = d(0);
  const preparedPayments = payments
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

  if (preparedPayments.length === 0) throw new Error("Payment amount must be > 0.");
  if (!paidTotal.equals(gross)) {
    throw new Error("No credit sales: payment total must equal gross amount.");
  }

  const invoiceNo = await allocateInvoiceNo(settings.invoicePrefix, soldAt);

  await prisma.sale.create({
    data: {
      invoiceNo,
      soldAt,
      customerId: customer.id,
      createdByUserId,
      customerNameSnapshot: customer.name,
      customerTaxpayerIdSnapshot: customer.taxpayerId,
      taxRegimeId: customer.taxRegimeId,
      vatRateSnapshot: vatRate,
      netAmount: net,
      vatAmount: vat,
      grossAmount: gross,
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
  });

  revalidatePath("/pos");
  revalidatePath("/dashboard");
}

