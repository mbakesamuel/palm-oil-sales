"use server";

import { getPrismaClient } from "@/lib/prisma";
import { allocateInvoiceNo } from "@/lib/invoice";
import {
  resolveCommercialServiceForUserId,
} from "@/lib/commercial-service";
import {
  assertPostingPeriod,
  assertTransactionDateInWorkingMonth,
  getOpenFinancialYearPeriod,
  toOpenFinancialYearForPosting,
} from "@/lib/financial-year";
import { noonUtcFromIsoDate, normalizeIsoDateInput, prismaDateToIso, utcIsoDateToday } from "@/lib/posting-calendar";
import { getOrInitCompanySettings } from "@/lib/settings";
import { VAT_TAX_CODE } from "@/lib/tax/constants";
import { legacyVatSnapshotFromResolved } from "@/lib/tax/resolve";
import { resolveTaxesForCustomer } from "@/lib/tax/resolve-customer";
import {
  deliveryOrderPosUsageError,
  loadDeliveryOrderControl,
  toDeliveryOrderLookupDto,
  validateSaleAgainstDeliveryOrder,
  type DeliveryOrderLookupDto,
} from "@/lib/delivery-order-sale-control";
import { assertPermissionKey, getPermissionsForSession } from "@/lib/access-control";
import { canPickPendingPosSales, roleRequiresSalesPoint } from "@/lib/auth-roles";
import type { UserRole as AppUserRole } from "@/lib/domain";
import { getServerSession } from "@/lib/auth-server";
import {
  salesPointErrorForResource,
  salesPointErrorForSubmitted,
} from "@/lib/auth-sales-point-scope";
import {
  assertCustomerMatchesPostingLine,
  commercialServiceErrorForCustomer,
  validateCustomerForCommercialPosting,
} from "@/lib/customer-commercial";
import {
  commercialServiceErrorForOperations,
  commercialServiceErrorForResource,
  deliveryOrderWhereForScope,
  mergeWhereWithServiceScope,
  resolveServiceScope,
  saleWhereForScope,
} from "@/lib/service-scope";
import type { SalePrintModel } from "@/components/SalePrint";
import { resolveUnitPriceExTax } from "@/lib/pricing/resolve";
import { isInsufficientStockError } from "@/lib/stock/errors";
import {
  assertPosLocationSellable,
  assertPosSellableQtyAvailable,
  getLocationStockBreakdown,
  isPosLocationBlockedByUnsellableStock,
} from "@/lib/stock/pos-location";
import { applyMovement } from "@/lib/stock/post";
import { resolveDefaultStorageLocationId } from "@/lib/stock/storage-location";
import {
  PaymentMethod,
  Prisma,
  StockCondition,
  StockMovementKind,
  ValidationStatus,
  UserRole,
} from "@prisma/client";
import { revalidatePath } from "next/cache";

type PosLineInput = {
  productId: string;
  qtyKg: string;
  qtyUnits?: string;
  unitPricePerKg: string;
  unitPricePerUnit?: string;
  storageLocationId: string;
};

type PosPaymentInput = {
  method: "CASH" | "CHEQUE" | "TRAITE";
  amount: string;
  chequeNo?: string;
  bank?: string;
  traiteNo?: string;
  traiteIssuedOn?: string;
  traiteMaturityOn?: string;
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
    storageLocationId: number | null;
    qtyKg: string;
    qtyUnits: string | null;
    unitPricePerKg: string;
    unitPricePerUnit: string | null;
    lineNet: string;
    lineVat: string;
    lineGross: string;
  }>;
  payments: Array<{
    method: PaymentMethod;
    amount: string;
    chequeNo: string | null;
    bank: string | null;
    traiteNo: string | null;
    traiteIssuedOn: string | null;
    traiteMaturityOn: string | null;
    paidAtIso: string;
  }>;
  appliedTaxes: Array<{
    code: string;
    label: string;
    rate: string;
    amount: string;
  }>;
};

export type PosTaxPreviewRow = {
  code: string;
  label: string;
  rate: string;
  ratePercentLabel: string;
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
  if (effectiveSalesPointId == null) {
    return { ok: false, error: "Sales point is required." };
  }
  if (!deliveryOrderNo) {
    return { ok: false, error: "Delivery Order number is required." };
  }

  const scope = resolveServiceScope(session);
  const csOpErr = commercialServiceErrorForOperations(scope);
  if (csOpErr) return { ok: false, error: csOpErr };

  if (!Array.isArray(lines) || lines.length === 0) return { ok: false, error: "Add at least one line." };
  if (!Array.isArray(payments) || payments.length === 0)
    return { ok: false, error: "Add at least one payment." };

  const [customer, openPeriod] = await Promise.all([
    prisma.customer.findUnique({
      where: { id: customerId },
      select: {
        id: true,
        name: true,
        taxpayerId: true,
        taxRegimeId: true,
        customerType: true,
        commercialServiceId: true,
      },
    }),
    getOpenFinancialYearPeriod(),
  ]);

  if (!customer) return { ok: false, error: "Customer not found." };

  const custScopeErr = commercialServiceErrorForCustomer(scope, customer.commercialServiceId);
  if (custScopeErr) return { ok: false, error: custScopeErr };

  const commercialService = await resolveCommercialServiceForUserId(prisma, session.userId);

  const lineMismatch = assertCustomerMatchesPostingLine(
    customer.commercialServiceId,
    commercialService.id,
  );
  if (lineMismatch) return { ok: false, error: lineMismatch };

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

  let net = d(0);
  let preparedLines: Array<{
    productId: number;
    storageLocationId: number;
    qtyKg: Prisma.Decimal;
    qtyUnits: Prisma.Decimal | null;
    unitPrice: Prisma.Decimal;
    lineNet: Prisma.Decimal;
  }> = [];
  try {
    preparedLines = [];
    for (const l of lines) {
      if (!l.productId) throw new Error("Each line must have a product.");
      const productId = Number.parseInt(l.productId, 10);
      if (!Number.isFinite(productId)) throw new Error("Invalid product selected.");
      const storageLocationId = Number.parseInt(String(l.storageLocationId ?? ""), 10);
      if (!Number.isFinite(storageLocationId)) throw new Error("Storage location is required on each line.");
      if (effectiveSalesPointId == null) throw new Error("Sales point is required.");
      const locOk = await prisma.storageLocation.findFirst({
        where: { id: storageLocationId, salesPointId: effectiveSalesPointId },
        select: { id: true },
      });
      if (!locOk) throw new Error("One or more storage locations do not belong to the selected sales point.");
      const product = await prisma.product.findUnique({
        where: { productId },
        select: {
          productName: true,
          productCat: { select: { isBottled: true } },
        },
      });
      if (!product) throw new Error("Product not found.");
      if (product.productCat?.isBottled === true) {
        throw new Error(
          `Bottled product "${product.productName}" is not sold on this page. Use Bottled Palm Oil sales (/bpo-sales).`,
        );
      }

      const qtyKg = d(l.qtyKg);
      if (qtyKg.lte(0)) throw new Error("Qty must be > 0.");
      const priced = await resolveUnitPriceExTax(
        prisma,
        productId,
        customer.customerType,
        soldAt,
      );
      if (!priced.ok) throw new Error(priced.error);
      const price = money2(priced.unitPriceExTax);

      if (price.lt(0)) throw new Error("Unit price must be >= 0.");
      const lineNet = money2(qtyKg.mul(price));
      net = net.add(lineNet);

      preparedLines.push({
        productId,
        storageLocationId,
        qtyKg,
        qtyUnits: null,
        unitPrice: price,
        lineNet,
      });
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Invalid line items." };
  }

  if (deliveryOrderNo) {
    const linkedDo = await prisma.deliveryOrder.findUnique({
      where: { deliveryOrderNo },
      select: { commercialServiceId: true },
    });
    const doCsErr = commercialServiceErrorForResource(
      scope,
      linkedDo?.commercialServiceId ?? null,
    );
    if (doCsErr) return { ok: false, error: doCsErr };

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

  try {
    const stockByLocation = new Map<
      string,
      {
        productId: number;
        storageLocationId: number;
        qtyKg: Prisma.Decimal;
      }
    >();
    for (const l of preparedLines) {
      const key = `${l.productId}:${l.storageLocationId}`;
      const existing = stockByLocation.get(key);
      if (existing) {
        existing.qtyKg = existing.qtyKg.add(l.qtyKg);
      } else {
        stockByLocation.set(key, {
          productId: l.productId,
          storageLocationId: l.storageLocationId,
          qtyKg: l.qtyKg,
        });
      }
    }
    for (const group of stockByLocation.values()) {
      await assertPosSellableQtyAvailable(prisma, {
        salesPointId: effectiveSalesPointId,
        storageLocationId: group.storageLocationId,
        productId: group.productId,
        qty: group.qtyKg,
      });
    }
  } catch (e) {
    if (isInsufficientStockError(e)) {
      return { ok: false, error: e.message };
    }
    return { ok: false, error: e instanceof Error ? e.message : "Invalid storage location." };
  }

  const resolved = await resolveTaxesForCustomer(prisma, customer.id, soldAt);
  if (!resolved.ok) return { ok: false, error: resolved.error };

  const appliedTaxCreates = resolved.taxes.map((t) => ({
    taxTypeId: t.taxTypeId,
    codeSnapshot: t.code,
    labelSnapshot: t.label,
    rateSnapshot: t.rate,
    amount: money2(net.mul(t.rate)),
  }));

  const totalTax = appliedTaxCreates.reduce((acc, row) => acc.add(row.amount), d(0));
  const vatAmount = appliedTaxCreates
    .filter((r) => r.codeSnapshot === VAT_TAX_CODE)
    .reduce((acc, r) => acc.add(r.amount), d(0));
  const { vatRateSnapshot } = legacyVatSnapshotFromResolved(resolved.taxes);
  const gross = money2(net.add(totalTax));

  let lineVatRunning = d(0);
  const lineCreates = preparedLines.map((l, idx) => {
    const isLast = idx === preparedLines.length - 1;
    let lineVat: Prisma.Decimal;
    if (net.lte(0)) {
      lineVat = d(0);
    } else if (isLast) {
      lineVat = money2(totalTax.sub(lineVatRunning));
    } else {
      lineVat = money2(l.lineNet.div(net).mul(totalTax));
      lineVatRunning = lineVatRunning.add(lineVat);
    }
    return {
      productId: l.productId,
      storageLocationId: l.storageLocationId,
      qtyKg: l.qtyKg,
      qtyUnits: l.qtyUnits,
      unitPricePerKg: l.unitPrice,
      unitPricePerUnit: null,
      lineNet: l.lineNet,
      lineVat,
      lineGross: money2(l.lineNet.add(lineVat)),
    };
  });

  let paidTotal = d(0);
  let preparedPayments: Array<{
    method: PaymentMethod;
    amount: Prisma.Decimal;
    chequeNo: string | null;
    bank: string | null;
    traiteNo: string | null;
    traiteIssuedOn: Date | null;
    traiteMaturityOn: Date | null;
  }> = [];
  try {
    preparedPayments = payments
      .filter((p) => d(p.amount).gt(0))
      .map((p) => {
        const amount = money2(d(p.amount));
        if (amount.lte(0)) throw new Error("Payment amount must be > 0.");

        const rawMethod = String(p.method ?? "").toUpperCase();
        if (rawMethod === "CREDIT") {
          throw new Error("Credit payments cannot be created from this screen.");
        }
        const method =
          rawMethod === "CHEQUE"
            ? PaymentMethod.CHEQUE
            : rawMethod === "TRAITE"
              ? PaymentMethod.TRAITE
              : PaymentMethod.CASH;

        let chequeNo: string | null = null;
        let bank: string | null = null;
        let traiteNo: string | null = null;
        let traiteIssuedOn: Date | null = null;
        let traiteMaturityOn: Date | null = null;

        if (method === PaymentMethod.CHEQUE) {
          chequeNo = String(p.chequeNo ?? "").trim() || null;
          const bankRaw = String(p.bank ?? "").trim();
          bank = bankRaw ? bankRaw : null;
          if (!chequeNo) {
            throw new Error("Cheque number is required for cheque payments.");
          }
        } else if (method === PaymentMethod.TRAITE) {
          traiteNo = String(p.traiteNo ?? "").trim() || null;
          const bankRaw = String(p.bank ?? "").trim();
          bank = bankRaw ? bankRaw : null;
          const issuedIso = normalizeIsoDateInput(String(p.traiteIssuedOn ?? ""));
          const maturityIso = normalizeIsoDateInput(String(p.traiteMaturityOn ?? ""));
          if (!traiteNo) throw new Error("Traite number is required for traite payments.");
          if (!bank) throw new Error("Bank is required for traite payments.");
          if (!issuedIso) throw new Error("Traite date issued is required.");
          if (!maturityIso) throw new Error("Traite maturity date is required.");
          traiteIssuedOn = noonUtcFromIsoDate(issuedIso);
          traiteMaturityOn = noonUtcFromIsoDate(maturityIso);
          if (traiteMaturityOn < traiteIssuedOn) {
            throw new Error("Traite maturity date cannot be before the date issued.");
          }
        }

        paidTotal = paidTotal.add(amount);
        return {
          method,
          amount,
          chequeNo,
          bank,
          traiteNo,
          traiteIssuedOn,
          traiteMaturityOn,
        };
      });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Invalid payments." };
  }

  if (preparedPayments.length === 0) return { ok: false, error: "Payment amount must be > 0." };
  if (!paidTotal.equals(gross)) {
    return { ok: false, error: "No credit sales: payment total must equal gross amount." };
  }

  const invoiceNo = await allocateInvoiceNo(prisma, commercialService.id, soldAt);

  if (effectiveSalesPointId == null) {
    return {
      ok: false,
      error: "Sales point is required to raise a sales invoice.",
    };
  }

  let created: { id: string; invoiceNo: string; soldAt: Date };
  try {
    created = await prisma.$transaction(
      async (tx) => {
        const sale = await tx.sale.create({
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
            vatRateSnapshot,
            netAmount: net,
            vatAmount,
            grossAmount: gross,
            financialYear: postingFY,
            financialMonth: postingCalendarMonth,
            postingCalendarYear,
            commercialServiceId: commercialService.id,
            issuerPhoneSnapshot: commercialService.phone ?? null,
            issuerAddressSnapshot: commercialService.address ?? null,
            commercialServiceNameSnapshot: commercialService.name,
            appliedTaxes: { create: appliedTaxCreates },
            lines: { create: lineCreates },
            payments: {
              create: preparedPayments.map((p) => ({
                method: p.method,
                amount: p.amount,
                chequeNo: p.chequeNo,
                bank: p.bank,
                traiteNo: p.traiteNo,
                traiteIssuedOn: p.traiteIssuedOn,
                traiteMaturityOn: p.traiteMaturityOn,
                paidAt: soldAt,
              })),
            },
          },
          select: { id: true, invoiceNo: true, soldAt: true },
        });

        return { id: sale.id, invoiceNo: sale.invoiceNo, soldAt: sale.soldAt };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not create sale." };
  }

  revalidatePath("/pos");
  revalidatePath("/dashboard");

  return { ok: true, id: created.id, invoiceNo: created.invoiceNo, soldAtIso: created.soldAt.toISOString() };
}

export async function previewPosTaxes(
  customerId: string,
  transactionIso: string,
): Promise<{ ok: true; taxes: PosTaxPreviewRow[] } | { ok: false; error: string }> {
  const prisma = getPrismaClient();
  let session: Awaited<ReturnType<typeof requireActor>>["session"];
  try {
    await assertPermissionKey("route:/pos");
    ({ session } = await requireActor(prisma));
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Login required." };
  }

  const cid = String(customerId ?? "").trim();
  if (!cid) return { ok: false, error: "Customer is required." };

  const scope = resolveServiceScope(session);
  const csOpErr = commercialServiceErrorForOperations(scope);
  if (csOpErr) return { ok: false, error: csOpErr };

  const commercialService = await resolveCommercialServiceForUserId(prisma, session.userId);
  const custCheck = await validateCustomerForCommercialPosting(
    prisma,
    scope,
    cid,
    commercialService.id,
  );
  if (!custCheck.ok) return custCheck;

  const iso = normalizeIsoDateInput(transactionIso) ?? utcIsoDateToday();
  const soldAt = noonUtcFromIsoDate(iso);

  const customer = await prisma.customer.findUnique({
    where: { id: cid },
    select: { id: true },
  });
  if (!customer) return { ok: false, error: "Customer not found." };

  const resolved = await resolveTaxesForCustomer(prisma, customer.id, soldAt);
  if (!resolved.ok) return { ok: false, error: resolved.error };

  return {
    ok: true,
    taxes: resolved.taxes.map((t) => {
      const pct = new Prisma.Decimal(t.rate.toString())
        .mul(100)
        .toDecimalPlaces(2)
        .toString();
      return {
        code: t.code,
        label: t.label,
        rate: t.rate.toString(),
        ratePercentLabel: pct,
      };
    }),
  };
}

export type PosLineStockPreview =
  | {
      ok: true;
      sellableQty: string;
      unsellableQty: string;
      salesBlocked: boolean;
      message: string | null;
    }
  | { ok: false; error: string };

export async function previewPosLineStock(
  salesPointIdRaw: string,
  storageLocationIdRaw: string,
  productIdRaw: string,
): Promise<PosLineStockPreview> {
  const prisma = getPrismaClient();
  let actor: Awaited<ReturnType<typeof requireActor>>["actor"];
  try {
    await assertPermissionKey("route:/pos");
    ({ actor } = await requireActor(prisma));
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Login required." };
  }

  const salesPointId = Number.parseInt(String(salesPointIdRaw ?? "").trim(), 10);
  const storageLocationId = Number.parseInt(String(storageLocationIdRaw ?? "").trim(), 10);
  const productId = Number.parseInt(String(productIdRaw ?? "").trim(), 10);
  if (!Number.isFinite(salesPointId) || salesPointId <= 0) {
    return { ok: false, error: "Sales point is required." };
  }
  if (!Number.isFinite(storageLocationId) || storageLocationId <= 0) {
    return { ok: false, error: "Storage location is required." };
  }
  if (!Number.isFinite(productId) || productId <= 0) {
    return { ok: false, error: "Product is required." };
  }

  const spErr = salesPointErrorForSubmitted(actor, salesPointId);
  if (spErr) return { ok: false, error: spErr };

  const locOk = await prisma.storageLocation.findFirst({
    where: { id: storageLocationId, salesPointId },
    select: { name: true },
  });
  if (!locOk) {
    return { ok: false, error: "Storage location does not belong to the selected sales point." };
  }

  const breakdown = await getLocationStockBreakdown(
    prisma,
    salesPointId,
    storageLocationId,
    productId,
  );
  const salesBlocked = isPosLocationBlockedByUnsellableStock(breakdown);
  let message: string | null = null;
  if (salesBlocked) {
    message = `This location holds ${breakdown.unsellableQty.toString()} kg unsellable stock for this product. Sales from this location are not allowed.`;
  }

  return {
    ok: true,
    sellableQty: breakdown.sellableQty.toString(),
    unsellableQty: breakdown.unsellableQty.toString(),
    salesBlocked,
    message,
  };
}

function money2Print(value: Prisma.Decimal) {
  return value.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

export type PendingSaleRow = {
  invoiceNo: string;
  soldAtIso: string;
  customerName: string;
  totalLabel: string;
  salesPointName: string | null;
};

/**
 * Lightweight listing of PENDING palm-oil sales for the supervisor lookup
 * combo (typed input + popover picker). Scope- and sales-point-aware.
 */
export async function listPendingSales(): Promise<PendingSaleRow[]> {
  const prisma = getPrismaClient();
  let session: Awaited<ReturnType<typeof requireActor>>["session"];
  let actor: Awaited<ReturnType<typeof requireActor>>["actor"];
  try {
    await assertPermissionKey("route:/pos");
    ({ session, actor } = await requireActor(prisma));
  } catch {
    return [];
  }

  const perms = await getPermissionsForSession(session);
  if (
    !canPickPendingPosSales({
      validateDocuments: perms["ui:validate-documents"],
      role: actor.role as AppUserRole,
      commercialServiceRoleCode: session.commercialServiceRole?.code,
    })
  ) {
    return [];
  }

  const scope = resolveServiceScope(session);
  if (commercialServiceErrorForOperations(scope)) return [];

  const salesPointFilter =
    actor.salesPointId != null && roleRequiresSalesPoint(actor.role as AppUserRole)
      ? { salesPointId: actor.salesPointId }
      : {};

  const rows = await prisma.sale.findMany({
    where: mergeWhereWithServiceScope(
      {
        status: ValidationStatus.PENDING,
        ...salesPointFilter,
        lines: {
          some: { product: { productCat: { isBottled: false } } },
        },
      },
      scope,
      saleWhereForScope,
    ),
    orderBy: [{ soldAt: "desc" }, { invoiceNo: "desc" }],
    take: 200,
    select: {
      invoiceNo: true,
      soldAt: true,
      grossAmount: true,
      customerNameSnapshot: true,
      salesPoint: { select: { name: true } },
    },
  });

  return rows.map((r) => {
    const gross = money2Print(r.grossAmount);
    const fmt = gross.gt(0)
      ? `${gross.toNumber().toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })} XAF`
      : "";
    return {
      invoiceNo: r.invoiceNo,
      soldAtIso: r.soldAt.toISOString().slice(0, 10),
      customerName: r.customerNameSnapshot,
      totalLabel: fmt,
      salesPointName: r.salesPoint?.name ?? null,
    };
  });
}

export async function loadSaleByInvoiceNo(rawNo: string): Promise<LoadedSaleView | null> {
  const invoiceNo = String(rawNo ?? "").trim();
  if (!invoiceNo) return null;

  const prisma = getPrismaClient();
  let actor;
  let session;
  try {
    await assertPermissionKey("route:/pos");
    ({ session, actor } = await requireActor(prisma));
  } catch {
    return null;
  }

  const scope = resolveServiceScope(session);

  const row = await prisma.sale.findUnique({
    where: { invoiceNo },
    include: {
      customer: { select: { id: true, name: true, taxpayerId: true, taxRegime: { select: { vatApplies: true } } } },
      createdBy: { select: { id: true, name: true } },
      validatedBy: { select: { id: true, name: true } },
      salesPoint: { select: { id: true, name: true } },
      appliedTaxes: { orderBy: { id: "asc" } },
      lines: {
        include: {
          product: { select: { productName: true, productCat: { select: { productCat: true } } } },
        },
        orderBy: { id: "asc" },
      },
      payments: { orderBy: { id: "asc" } },
    },
  });
  if (!row) return null;

  const accessErr = salesPointErrorForResource(actor, row.salesPointId ?? null);
  if (accessErr) return null;
  const csErr = commercialServiceErrorForResource(scope, row.commercialServiceId);
  if (csErr) return null;

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
    vatApplies:
      row.appliedTaxes.length > 0
        ? row.appliedTaxes.some(
            (t) =>
              t.codeSnapshot === VAT_TAX_CODE &&
              new Prisma.Decimal(t.amount).gt(0),
          )
        : (row.customer.taxRegime?.vatApplies ?? false),
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
      storageLocationId: l.storageLocationId ?? null,
      qtyKg: l.qtyKg.toString(),
      qtyUnits: l.qtyUnits?.toString() ?? null,
      unitPricePerKg: l.unitPricePerKg.toString(),
      unitPricePerUnit: l.unitPricePerUnit?.toString() ?? null,
      lineNet: l.lineNet.toString(),
      lineVat: l.lineVat.toString(),
      lineGross: l.lineGross.toString(),
    })),
    payments: row.payments.map((p) => ({
      method: p.method,
      amount: p.amount.toString(),
      chequeNo: p.chequeNo ?? null,
      bank: p.bank ?? null,
      traiteNo: p.traiteNo ?? null,
      traiteIssuedOn: p.traiteIssuedOn ? prismaDateToIso(p.traiteIssuedOn) : null,
      traiteMaturityOn: p.traiteMaturityOn ? prismaDateToIso(p.traiteMaturityOn) : null,
      paidAtIso: p.paidAt.toISOString(),
    })),
    appliedTaxes: row.appliedTaxes.map((t) => ({
      code: t.codeSnapshot,
      label: t.labelSnapshot,
      rate: t.rateSnapshot.toString(),
      amount: t.amount.toString(),
    })),
  };
}

export type AvailableDeliveryOrderRow = {
  deliveryOrderNo: string;
  dateIssued: string;
  customerName: string;
  balanceKg: string;
};

/**
 * Validated delivery orders at a sales point that still have qty balance
 * (for the POS D.O. combo picker).
 */
export async function listAvailableDeliveryOrdersForSale(
  salesPointIdRaw: string,
): Promise<AvailableDeliveryOrderRow[]> {
  const salesPointId = Number.parseInt(String(salesPointIdRaw ?? "").trim(), 10);
  if (!Number.isFinite(salesPointId)) return [];

  const prisma = getPrismaClient();
  let actor: Awaited<ReturnType<typeof requireActor>>["actor"];
  let session: Awaited<ReturnType<typeof requireActor>>["session"];
  try {
    await assertPermissionKey("route:/pos");
    ({ session, actor } = await requireActor(prisma));
  } catch {
    return [];
  }

  const scope = resolveServiceScope(session);
  if (commercialServiceErrorForOperations(scope)) return [];

  const spErr = salesPointErrorForSubmitted(actor, salesPointId);
  if (spErr) return [];

  const scopeWhere = deliveryOrderWhereForScope(scope) ?? {};

  const orders = await prisma.deliveryOrder.findMany({
    where: {
      ...scopeWhere,
      salesPointId,
      status: ValidationStatus.VALIDATED,
    },
    orderBy: [{ dateIssued: "desc" }, { deliveryOrderNo: "desc" }],
    take: 200,
    select: {
      deliveryOrderNo: true,
      dateIssued: true,
      customer: { select: { name: true } },
    },
  });

  const rows = await Promise.all(
    orders.map(async (o) => {
      const ctx = await loadDeliveryOrderControl(o.deliveryOrderNo);
      if (!ctx) return null;
      const balance = new Prisma.Decimal(ctx.totalBalanceKg);
      if (balance.lte(0)) return null;
      return {
        deliveryOrderNo: o.deliveryOrderNo,
        dateIssued: o.dateIssued.toISOString().slice(0, 10),
        customerName: o.customer.name,
        balanceKg: ctx.totalBalanceKg,
      };
    }),
  );

  return rows.filter((r): r is AvailableDeliveryOrderRow => r != null);
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
  let session: Awaited<ReturnType<typeof requireActor>>["session"];
  try {
    await assertPermissionKey("route:/pos");
    ({ session, actor } = await requireActor(prisma));
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Login required." };
  }

  const scope = resolveServiceScope(session);

  const ctx = await loadDeliveryOrderControl(deliveryOrderNo);
  if (!ctx) {
    return { ok: false, error: "No delivery order with that number." };
  }

  const orderSp = await prisma.deliveryOrder.findUnique({
    where: { deliveryOrderNo },
    select: { salesPointId: true, status: true, commercialServiceId: true },
  });
  const accessErr = salesPointErrorForResource(actor, orderSp?.salesPointId ?? null);
  if (accessErr) {
    return { ok: false, error: accessErr };
  }
  const csErr = commercialServiceErrorForResource(scope, orderSp?.commercialServiceId ?? null);
  if (csErr) {
    return { ok: false, error: csErr };
  }

  const statusErr = deliveryOrderPosUsageError(orderSp?.status);
  if (statusErr) {
    return { ok: false, error: statusErr };
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
  let session: Awaited<ReturnType<typeof requireActor>>["session"];
  try {
    await assertPermissionKey("route:/pos");
    ({ session, actor } = await requireActor(prisma));
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Login required." };
  }

  const scope = resolveServiceScope(session);

  const existing = await prisma.sale.findUnique({
    where: { id },
    select: { invoiceNo: true, status: true, salesPointId: true, commercialServiceId: true },
  });
  if (!existing) return { ok: false, error: "Sale not found." };
  const accessErr = salesPointErrorForResource(actor, existing.salesPointId ?? null);
  if (accessErr) return { ok: false, error: accessErr };
  const csErr = commercialServiceErrorForResource(scope, existing.commercialServiceId);
  if (csErr) return { ok: false, error: csErr };
  if (existing.status === ValidationStatus.VALIDATED) {
    return { ok: false, error: "Validated invoices cannot be deleted." };
  }

  try {
    await prisma.sale.delete({ where: { id } });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not delete sale." };
  }

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

  const perms = await getPermissionsForSession(session);
  if (!perms["ui:validate-documents"]) {
    return {
      ok: false,
      error: "You do not have permission to validate sales invoices.",
    };
  }

  const scope = resolveServiceScope(session);

  const existing = await prisma.sale.findUnique({
    where: { id },
    select: {
      status: true,
      salesPointId: true,
      commercialServiceId: true,
      deliveryOrderNo: true,
      soldAt: true,
      lines: {
        select: {
          productId: true,
          storageLocationId: true,
          qtyKg: true,
          qtyUnits: true,
          product: {
            select: { productCat: { select: { isBottled: true } } },
          },
        },
      },
    },
  });
  if (!existing) return { ok: false, error: "Sale not found." };
  const accessErr = salesPointErrorForResource(actor, existing.salesPointId ?? null);
  if (accessErr) return { ok: false, error: accessErr };
  const csErr = commercialServiceErrorForResource(scope, existing.commercialServiceId);
  if (csErr) return { ok: false, error: csErr };
  if (existing.status === ValidationStatus.VALIDATED) return { ok: true };
  if (existing.salesPointId == null) {
    return {
      ok: false,
      error: "This invoice has no sales point; cannot deduct stock on validation.",
    };
  }
  const stockSalesPointId: number = existing.salesPointId;
  if (!existing.deliveryOrderNo) {
    return { ok: false, error: "Delivery Order number is required." };
  }

  const linkedDo = await prisma.deliveryOrder.findUnique({
    where: { deliveryOrderNo: existing.deliveryOrderNo },
    select: { status: true },
  });
  const doStatusErr = deliveryOrderPosUsageError(linkedDo?.status);
  if (doStatusErr) {
    return { ok: false, error: doStatusErr };
  }

  try {
    await prisma.$transaction(
      async (tx) => {
        for (const line of existing.lines) {
          const storageLocationId =
            line.storageLocationId ??
            (await resolveDefaultStorageLocationId(tx, stockSalesPointId));
          await assertPosLocationSellable(tx, {
            salesPointId: stockSalesPointId,
            storageLocationId,
            productId: line.productId,
          });
          const qty = line.product.productCat?.isBottled
            ? (line.qtyUnits ?? line.qtyKg)
            : line.qtyKg;
          if (new Prisma.Decimal(qty).lte(0)) continue;
          await applyMovement(tx, {
            salesPointId: stockSalesPointId,
            productId: line.productId,
            storageLocationId,
            condition: StockCondition.SELLABLE,
            qty,
            kind: StockMovementKind.SALE,
            occurredAt: existing.soldAt,
            userId: session.userId,
            sourceKind: "SALE",
            sourceId: id,
          });
        }

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
    if (isInsufficientStockError(e)) {
      return { ok: false, error: e.message };
    }
    return { ok: false, error: e instanceof Error ? e.message : "Could not validate sale." };
  }

  revalidatePath("/pos");
  revalidatePath(`/sales/${id}`);
  revalidatePath("/dashboard");
  revalidatePath("/stock");
  return { ok: true };
}

export type SalePrintPayload = {
  companyName: string;
  department: string | null;
  companyPhone: string | null;
  companyAddress: string | null;
  logoSrc: string;
  sale: SalePrintModel;
};

export async function loadSalePrintById(
  saleId: string,
): Promise<{ ok: true; data: SalePrintPayload } | { ok: false; reason: "auth" | "missing" }> {
  const sid = String(saleId ?? "").trim();
  if (!sid) return { ok: false, reason: "missing" };

  const prisma = getPrismaClient();
  let actor;
  let session;
  let settings;
  try {
    await assertPermissionKey("route:/pos");
    const r = await requireActor(prisma);
    actor = r.actor;
    session = r.session;
    settings = await getOrInitCompanySettings();
  } catch {
    return { ok: false, reason: "auth" };
  }

  const scope = resolveServiceScope(session);

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
      appliedTaxes: { orderBy: { id: "asc" } },
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
  if (commercialServiceErrorForResource(scope, sale.commercialServiceId)) {
    return { ok: false, reason: "missing" };
  }

  const appliedTaxLines =
    sale.appliedTaxes.length > 0
      ? sale.appliedTaxes.map((t) => ({
          label: t.labelSnapshot,
          ratePercentLabel: new Prisma.Decimal(t.rateSnapshot.toString())
            .mul(100)
            .toDecimalPlaces(2)
            .toString(),
          amount: t.amount.toString(),
        }))
      : new Prisma.Decimal(sale.vatAmount).gt(0)
        ? [
            {
              label: "VAT",
              ratePercentLabel: new Prisma.Decimal(sale.vatRateSnapshot.toString())
                .mul(100)
                .toDecimalPlaces(2)
                .toString(),
              amount: sale.vatAmount.toString(),
            },
          ]
        : [];

  const vatAppliesSnapshot =
    sale.appliedTaxes.length > 0
      ? sale.appliedTaxes.some(
          (t) =>
            t.codeSnapshot === VAT_TAX_CODE &&
            new Prisma.Decimal(t.amount).gt(0),
        )
      : (sale.customer.taxRegime?.vatApplies ?? false);

  const saleModel: SalePrintModel = {
    invoiceNo: sale.invoiceNo,
    soldAtIso: sale.soldAt.toISOString(),
    vehicleNumber: sale.vehicleNumber,
    dateIssuedIso: (sale.dateIssued ?? sale.soldAt).toISOString(),
    deliveryOrderNo: sale.deliveryOrderNo,
    customerName: sale.customer.name,
    taxpayerId: sale.customer.taxpayerId,
    vatApplies: vatAppliesSnapshot,
    appliedTaxLines,
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
      traiteNo: p.traiteNo ?? null,
      traiteIssuedOn: p.traiteIssuedOn ? prismaDateToIso(p.traiteIssuedOn) : null,
      traiteMaturityOn: p.traiteMaturityOn ? prismaDateToIso(p.traiteMaturityOn) : null,
      paidAtIso: p.paidAt.toISOString(),
    })),
  };

  const deptParts = [settings.department?.trim(), sale.commercialServiceNameSnapshot?.trim()].filter(
    (s): s is string => Boolean(s && s.length > 0),
  );
  const departmentLine = deptParts.length > 0 ? deptParts.join(" · ") : null;

  const logoSrc =
    settings.logoUrl && settings.logoUrl.trim() !== ""
      ? settings.logoUrl.trim()
      : "/logo.svg";

  return {
    ok: true,
    data: {
      companyName: settings.companyName,
      department: departmentLine,
      companyPhone: sale.issuerPhoneSnapshot ?? null,
      companyAddress: sale.issuerAddressSnapshot ?? null,
      logoSrc,
      sale: saleModel,
    },
  };
}
