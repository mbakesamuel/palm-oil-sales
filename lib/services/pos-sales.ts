import "server-only";

import { allocateInvoiceNo } from "@/lib/invoice";
import { resolveCommercialServiceForUserId } from "@/lib/commercial-service";
import {
  assertPostingPeriod,
  assertTransactionDateInWorkingMonth,
  getOpenFinancialYearPeriod,
  toOpenFinancialYearForPosting,
} from "@/lib/financial-year";
import { resolveWorkingMonthForSession } from "@/lib/sales-point-working-month";
import {
  noonUtcFromIsoDate,
  normalizeIsoDateInput,
  utcIsoDateToday,
  firstDayOfCalendarMonth,
  lastDayOfCalendarMonth,
} from "@/lib/posting-calendar";
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
import { getPermissionsForSession } from "@/lib/access-control";
import type { AuthSession } from "@/lib/auth-session";
import {
  actorFromAuthSession,
  salesPointErrorForResource,
  salesPointErrorForSubmitted,
} from "@/lib/auth-sales-point-scope";
import { assertCustomerSelectableForOperations } from "@/lib/customers/operational-customer-scope";
import { customerWhereForOperationalUI } from "@/lib/customers/operational-customer-scope";
import {
  assertCustomerMatchesPostingLine,
  commercialServiceErrorForCustomer,
  validateCustomerForCommercialPosting,
} from "@/lib/customer-commercial";
import {
  commercialServiceErrorForOperations,
  commercialServiceErrorForResource,
  deliveryOrderWhereForScope,
  resolveServiceScope,
} from "@/lib/service-scope";
import {
  assertDispositionForSaleMode,
  isNoDeliveryOrderDisposition,
  isNoTaxDisposition,
  isNonPaymentDisposition,
  parseSaleDisposition,
} from "@/lib/pos/sale-disposition";
import {
  assertSaleModeForSalesPoint,
  BOTTLE_VEHICLE_PLACEHOLDER,
  getOrCreatePosPlaceholderCustomer,
  getOrCreateWalkInCustomer,
  normalizeSaleModeForSalesPoint,
  parseSaleProductMode,
  PUBLIC_RELATION_POS_CUSTOMER_NAME,
  RATION_POS_CUSTOMER_NAME,
  resolveBotaSalesPointId,
} from "@/lib/pos/sale-product-mode";
import { loadPosPageConfig } from "@/lib/pos/load-pos-page-config";
import { getCustomerTypeIdByCode } from "@/lib/customer-types/catalog";
import { resolveBottledUnitPriceExTax, resolveUnitPriceExTax } from "@/lib/pricing/resolve";
import { isInsufficientStockError } from "@/lib/stock/errors";
import {
  assertPosSellableQtyAvailable,
  getLocationStockBreakdown,
  isPosLocationBlockedByUnsellableStock,
} from "@/lib/stock/pos-location";
import {
  assertPaymentMethodUsable,
  validatePaymentFields,
  ensureBuiltinPaymentMethods,
  listPaymentMethodDefinitions,
} from "@/lib/payment-methods/catalog";
import type { PaymentMethodKind } from "@/lib/payment-methods/types";
import { getPrismaClient } from "@/lib/prisma";
import { validateSaleForSession } from "@/lib/services/mobile-pending-sales";
import {
  Prisma,
  PosSaleProductMode,
  ValidationStatus,
} from "@prisma/client";

export type PosLineInput = {
  productId: string;
  qtyKg: string;
  qtyUnits?: string;
  unitPricePerKg: string;
  unitPricePerUnit?: string;
  storageLocationId: string;
};

export type PosPaymentInput = {
  paymentMethodId: string;
  amount: string;
  chequeNo?: string;
  bank?: string;
  traiteNo?: string;
  traiteIssuedOn?: string;
  traiteMaturityOn?: string;
};

export type CreateSaleInput = {
  customerId?: string;
  useWalkInCustomer?: boolean;
  walkInCustomerName?: string;
  typedCustomerName?: string;
  referenceNumber?: string;
  salesPointId?: number | null;
  saleProductMode: string;
  saleDisposition: string;
  vehicleNumber?: string;
  deliveryOrderNo?: string;
  transactionDate?: string;
  lines: PosLineInput[];
  payments: PosPaymentInput[];
};

export type SaveSaleResult =
  | { ok: true; id: string; invoiceNo: string; soldAtIso: string; grossAmount: string }
  | { ok: false; error: string };

export type CreateAndValidateSaleResult =
  | { ok: true; id: string; invoiceNo: string; soldAtIso: string; grossAmount: string; status: "VALIDATED" }
  | { ok: false; error: string; saleId?: string; invoiceNo?: string };

export type PosTaxPreviewRow = {
  code: string;
  label: string;
  rate: string;
  ratePercentLabel: string;
};

export type PosLineStockPreview =
  | {
      ok: true;
      sellableQty: string;
      unsellableQty: string;
      salesBlocked: boolean;
      message: string | null;
    }
  | { ok: false; error: string };

export type AvailableDeliveryOrderRow = {
  deliveryOrderNo: string;
  dateIssued: string;
  customerName: string;
  balanceKg: string;
};

function d(value: string | number) {
  return new Prisma.Decimal(value);
}

function money2(value: Prisma.Decimal) {
  return value.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

export function createSaleInputFromFormData(formData: FormData): CreateSaleInput {
  const salesPointRaw = String(formData.get("salesPointId") ?? "").trim();
  const salesPointId = salesPointRaw ? Number.parseInt(salesPointRaw, 10) : null;
  return {
    customerId: String(formData.get("customerId") ?? "").trim() || undefined,
    useWalkInCustomer: String(formData.get("useWalkInCustomer") ?? "") === "1",
    walkInCustomerName: String(formData.get("walkInCustomerName") ?? "").trim() || undefined,
    typedCustomerName: String(formData.get("typedCustomerName") ?? "").trim() || undefined,
    referenceNumber: String(formData.get("referenceNumber") ?? "").trim() || undefined,
    salesPointId: salesPointRaw && Number.isFinite(salesPointId) ? salesPointId : null,
    saleProductMode: String(formData.get("saleProductMode") ?? ""),
    saleDisposition: String(formData.get("saleDisposition") ?? ""),
    vehicleNumber: String(formData.get("vehicleNumber") ?? "").trim() || undefined,
    deliveryOrderNo: String(formData.get("deliveryOrderNo") ?? "").trim() || undefined,
    transactionDate: String(formData.get("transactionDate") ?? "").trim() || undefined,
    lines: JSON.parse(String(formData.get("lines") ?? "[]")) as PosLineInput[],
    payments: JSON.parse(String(formData.get("payments") ?? "[]")) as PosPaymentInput[],
  };
}

export async function createSaleForSession(session: AuthSession, input: CreateSaleInput): Promise<SaveSaleResult> {
  const prisma = getPrismaClient();
  const actor = actorFromAuthSession(session);
  if (!actor?.isActive) return { ok: false, error: "Login required." };

  const customerIdRaw = String(input.customerId ?? "").trim();
  const useWalkIn = input.useWalkInCustomer === true;
  const walkInCustomerName = String(input.walkInCustomerName ?? "").trim();
  const typedCustomerName = String(input.typedCustomerName ?? "").trim();
  const referenceNumberRaw = String(input.referenceNumber ?? "").trim();
  const salesPointId = input.salesPointId ?? null;
  const lines = input.lines ?? [];
  const payments = input.payments ?? [];
  const saleProductModeRaw = parseSaleProductMode(String(input.saleProductMode ?? ""));
  const saleDisposition = parseSaleDisposition(String(input.saleDisposition ?? ""));
  const vehicleNumberRaw = String(input.vehicleNumber ?? "").trim();
  const deliveryOrderNoRaw = String(input.deliveryOrderNo ?? "").trim();
  const transactionIso = normalizeIsoDateInput(String(input.transactionDate ?? "").trim()) ?? utcIsoDateToday();
  const soldAt = noonUtcFromIsoDate(transactionIso);

  const resolvedWorkingMonth = await resolveWorkingMonthForSession(session);
  if (!resolvedWorkingMonth) {
    return {
      ok: false,
      error:
        "Working financial period is missing. Set your working month under Financial years before posting.",
    };
  }
  const postingFY = resolvedWorkingMonth.financialYear;
  const postingCalendarYear = resolvedWorkingMonth.calendarYear;
  const postingCalendarMonth = resolvedWorkingMonth.calendarMonth;

  const effectiveSalesPointId = session.salesPoint?.id ?? salesPointId;
  const spErr = salesPointErrorForSubmitted(actor, effectiveSalesPointId);
  if (spErr) return { ok: false, error: spErr };
  if (effectiveSalesPointId == null) {
    return { ok: false, error: "Sales point is required." };
  }

  const botaSalesPointId = await resolveBotaSalesPointId(prisma);
  const saleProductMode = normalizeSaleModeForSalesPoint(
    saleProductModeRaw,
    effectiveSalesPointId,
    botaSalesPointId,
  );
  const modeErr = assertSaleModeForSalesPoint(
    saleProductMode,
    effectiveSalesPointId,
    botaSalesPointId,
  );
  if (modeErr) return { ok: false, error: modeErr };

  const dispositionErr = assertDispositionForSaleMode(
    saleDisposition,
    saleProductMode,
  );
  if (dispositionErr) return { ok: false, error: dispositionErr };

  const isBottleMode = saleProductMode === PosSaleProductMode.BOTTLE;
  const skipDo = isBottleMode || isNoDeliveryOrderDisposition(saleDisposition);
  const skipTax = isBottleMode || isNoTaxDisposition(saleDisposition);
  const skipPayment = isNonPaymentDisposition(saleDisposition);
  const referenceNumber = isBottleMode ? null : referenceNumberRaw || null;
  const deliveryOrderNo = skipDo ? null : deliveryOrderNoRaw || null;
  const vehicleNumber = isBottleMode
    ? vehicleNumberRaw || BOTTLE_VEHICLE_PLACEHOLDER
    : vehicleNumberRaw;

  if (!skipDo && !deliveryOrderNo) {
    return { ok: false, error: "Delivery Order number is required." };
  }
  if (!isBottleMode && !vehicleNumber) {
    return { ok: false, error: "Vehicle number is required." };
  }
  const usesTypedCustomerName =
    saleDisposition === "RATION" || saleDisposition === "PUBLIC_RELATION";
  if (usesTypedCustomerName) {
    if (!typedCustomerName) {
      return { ok: false, error: "Enter the customer name." };
    }
  } else if (isBottleMode && useWalkIn) {
    if (!walkInCustomerName) {
      return { ok: false, error: "Enter the walk-in customer name." };
    }
  } else if (!customerIdRaw) {
    return { ok: false, error: "Customer is required." };
  }

  const scope = resolveServiceScope(session);
  const csOpErr = commercialServiceErrorForOperations(scope);
  if (csOpErr) return { ok: false, error: csOpErr };

  if (!Array.isArray(lines) || lines.length === 0) return { ok: false, error: "Add at least one line." };
  if (!skipPayment && (!Array.isArray(payments) || payments.length === 0))
    return { ok: false, error: "Add at least one payment." };

  const commercialService = await resolveCommercialServiceForUserId(prisma, session.userId);

  let customer: {
    id: string;
    name: string;
    taxpayerId: string | null;
    taxRegimeId: string | null;
    customerTypeId: string;
    commercialServiceId: string;
  };
  let customerNameSnapshot: string;

  if (saleDisposition === "RATION") {
    const workerTypeId = await getCustomerTypeIdByCode("WORKER");
    if (!workerTypeId) {
      return { ok: false, error: "Worker customer type is not configured." };
    }
    const placeholder = await getOrCreatePosPlaceholderCustomer(
      prisma,
      commercialService.id,
      RATION_POS_CUSTOMER_NAME,
      workerTypeId,
    );
    customer = {
      id: placeholder.id,
      name: placeholder.name,
      taxpayerId: null,
      taxRegimeId: null,
      customerTypeId: placeholder.customerTypeId,
      commercialServiceId: commercialService.id,
    };
    customerNameSnapshot = typedCustomerName;
  } else if (saleDisposition === "PUBLIC_RELATION") {
    const workerTypeId = await getCustomerTypeIdByCode("WORKER");
    if (!workerTypeId) {
      return { ok: false, error: "Worker customer type is not configured." };
    }
    const placeholder = await getOrCreatePosPlaceholderCustomer(
      prisma,
      commercialService.id,
      PUBLIC_RELATION_POS_CUSTOMER_NAME,
      workerTypeId,
    );
    customer = {
      id: placeholder.id,
      name: placeholder.name,
      taxpayerId: null,
      taxRegimeId: null,
      customerTypeId: placeholder.customerTypeId,
      commercialServiceId: commercialService.id,
    };
    customerNameSnapshot = typedCustomerName;
  } else if (isBottleMode && useWalkIn) {
    const retailCustomerTypeId = await getCustomerTypeIdByCode("RETAIL");
    if (!retailCustomerTypeId) {
      return { ok: false, error: "Retail customer type is not configured." };
    }
    const walkIn = await getOrCreateWalkInCustomer(
      prisma,
      commercialService.id,
      retailCustomerTypeId,
    );
    customer = {
      id: walkIn.id,
      name: walkIn.name,
      taxpayerId: null,
      taxRegimeId: null,
      customerTypeId: walkIn.customerTypeId,
      commercialServiceId: commercialService.id,
    };
    customerNameSnapshot = walkInCustomerName;
  } else {
    const selectableCheck = await assertCustomerSelectableForOperations(
      prisma,
      customerIdRaw,
    );
    if (!selectableCheck.ok) {
      return { ok: false, error: selectableCheck.error };
    }
    const row = await prisma.customer.findUnique({
      where: { id: customerIdRaw },
      select: {
        id: true,
        name: true,
        taxpayerId: true,
        taxRegimeId: true,
        customerTypeId: true,
        commercialServiceId: true,
      },
    });
    if (!row) return { ok: false, error: "Customer not found." };
    customer = row;
    customerNameSnapshot = row.name;
  }

  const openPeriod = await getOpenFinancialYearPeriod();

  const custScopeErr = commercialServiceErrorForCustomer(scope, customer.commercialServiceId);
  if (custScopeErr) return { ok: false, error: custScopeErr };

  const lineMismatch = assertCustomerMatchesPostingLine(
    customer.commercialServiceId,
    commercialService.id,
  );
  if (lineMismatch) return { ok: false, error: lineMismatch };

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
    isBottled: boolean;
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
      const isBottled = product.productCat?.isBottled === true;
      if (isBottleMode && !isBottled) {
        throw new Error("Only bottled palm oil products are allowed in bottle sales mode.");
      }
      if (!isBottleMode && isBottled) {
        throw new Error("Bottled products cannot be sold in loose sales mode.");
      }
      let qtyKg: Prisma.Decimal;
      let qtyUnits: Prisma.Decimal | null;
      if (isBottled) {
        const units = d(l.qtyUnits ?? l.qtyKg);
        if (units.lte(0)) throw new Error("Qty must be > 0.");
        qtyKg = new Prisma.Decimal(0);
        qtyUnits = units;
      } else {
        qtyKg = d(l.qtyKg);
        if (qtyKg.lte(0)) throw new Error("Qty must be > 0.");
        qtyUnits = null;
      }
      let price: Prisma.Decimal;
      if (saleDisposition === "PUBLIC_RELATION") {
        price = d(0);
      } else if (isBottleMode && saleDisposition !== "RATION") {
        const priced = await resolveBottledUnitPriceExTax(prisma, productId, soldAt);
        if (!priced.ok) throw new Error(priced.error);
        price = money2(priced.unitPriceExTax);
      } else {
        const priced = await resolveUnitPriceExTax(
          prisma,
          productId,
          customer.customerTypeId,
          soldAt,
        );
        if (!priced.ok) throw new Error(priced.error);
        price = money2(priced.unitPriceExTax);
      }

      if (price.lt(0)) throw new Error("Unit price must be >= 0.");
      const lineQty = isBottled ? qtyUnits! : qtyKg;
      const lineNet = money2(lineQty.mul(price));
      net = net.add(lineNet);

      preparedLines.push({
        productId,
        storageLocationId,
        qtyKg,
        qtyUnits,
        isBottled,
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
      customerId: customer.id,
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
        qty: Prisma.Decimal;
      }
    >();
    for (const l of preparedLines) {
      const key = `${l.productId}:${l.storageLocationId}`;
      const lineQty = l.isBottled ? l.qtyUnits! : l.qtyKg;
      const existing = stockByLocation.get(key);
      if (existing) {
        existing.qty = existing.qty.add(lineQty);
      } else {
        stockByLocation.set(key, {
          productId: l.productId,
          storageLocationId: l.storageLocationId,
          qty: lineQty,
        });
      }
    }
    for (const group of stockByLocation.values()) {
      await assertPosSellableQtyAvailable(prisma, {
        salesPointId: effectiveSalesPointId,
        storageLocationId: group.storageLocationId,
        productId: group.productId,
        qty: group.qty,
      });
    }
  } catch (e) {
    if (isInsufficientStockError(e)) {
      return { ok: false, error: e.message };
    }
    return { ok: false, error: e instanceof Error ? e.message : "Invalid storage location." };
  }

  let appliedTaxCreates: Array<{
    taxTypeId: string | null;
    codeSnapshot: string;
    labelSnapshot: string;
    rateSnapshot: Prisma.Decimal;
    amount: Prisma.Decimal;
  }> = [];
  let totalTax = d(0);
  let vatAmount = d(0);
  let vatRateSnapshot = d(0);
  let gross = net;

  if (skipTax) {
    gross = money2(net);
  } else {
    const resolved = await resolveTaxesForCustomer(prisma, customer.id, soldAt);
    if (!resolved.ok) return { ok: false, error: resolved.error };

    appliedTaxCreates = resolved.taxes.map((t) => ({
      taxTypeId: t.taxTypeId,
      codeSnapshot: t.code,
      labelSnapshot: t.label,
      rateSnapshot: t.rate,
      amount: money2(net.mul(t.rate)),
    }));

    totalTax = appliedTaxCreates.reduce((acc, row) => acc.add(row.amount), d(0));
    vatAmount = appliedTaxCreates
      .filter((r) => r.codeSnapshot === VAT_TAX_CODE)
      .reduce((acc, r) => acc.add(r.amount), d(0));
    ({ vatRateSnapshot } = legacyVatSnapshotFromResolved(resolved.taxes));
    gross = money2(net.add(totalTax));
  }

  let lineVatRunning = d(0);
  const lineCreates = preparedLines.map((l, idx) => {
    let lineVat = d(0);
    if (!skipTax) {
      const isLast = idx === preparedLines.length - 1;
      if (net.lte(0)) {
        lineVat = d(0);
      } else if (isLast) {
        lineVat = money2(totalTax.sub(lineVatRunning));
      } else {
        lineVat = money2(l.lineNet.div(net).mul(totalTax));
        lineVatRunning = lineVatRunning.add(lineVat);
      }
    }
    return {
      productId: l.productId,
      storageLocationId: l.storageLocationId,
      qtyKg: l.qtyKg,
      qtyUnits: l.qtyUnits,
      unitPricePerKg: l.isBottled ? d(0) : l.unitPrice,
      unitPricePerUnit: l.isBottled ? l.unitPrice : null,
      lineNet: l.lineNet,
      lineVat,
      lineGross: money2(l.lineNet.add(lineVat)),
    };
  });

  let paidTotal = d(0);
  let preparedPayments: Array<{
    paymentMethodId: string;
    amount: Prisma.Decimal;
    chequeNo: string | null;
    bank: string | null;
    traiteNo: string | null;
    traiteIssuedOn: Date | null;
    traiteMaturityOn: Date | null;
  }> = [];
  if (!skipPayment) {
    try {
      preparedPayments = await Promise.all(
        payments
          .filter((p) => d(p.amount).gt(0))
          .map(async (p) => {
            const amount = money2(d(p.amount));
            if (amount.lte(0)) throw new Error("Payment amount must be > 0.");

            const paymentMethodId = String(p.paymentMethodId ?? "").trim();
            if (!paymentMethodId) throw new Error("Payment method is required.");

            const methodRow = await assertPaymentMethodUsable(paymentMethodId);
            if (methodRow.kind === "CREDIT") {
              throw new Error("Credit payments cannot be created from this screen.");
            }

            const fields = validatePaymentFields(
              methodRow.kind as PaymentMethodKind,
              p,
              { normalizeIsoDateInput, noonUtcFromIsoDate },
            );

            paidTotal = paidTotal.add(amount);
            return {
              paymentMethodId: methodRow.id,
              amount,
              ...fields,
            };
          }),
      );
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Invalid payments." };
    }

    if (preparedPayments.length === 0) return { ok: false, error: "Payment amount must be > 0." };
    if (!paidTotal.equals(gross)) {
      return { ok: false, error: "No credit sales: payment total must equal gross amount." };
    }
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
            saleProductMode,
            saleDisposition,
            status: ValidationStatus.PENDING,
            customerNameSnapshot,
            taxRegimeId: skipTax ? null : customer.taxRegimeId,
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
            payments: skipPayment
              ? undefined
              : {
                  create: preparedPayments.map((p) => ({
                    paymentMethodId: p.paymentMethodId,
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



  return { ok: true, id: created.id, invoiceNo: created.invoiceNo, soldAtIso: created.soldAt.toISOString(), grossAmount: gross.toString() };
}


export async function createAndValidateSaleForSession(
  session: AuthSession,
  input: CreateSaleInput,
): Promise<CreateAndValidateSaleResult> {
  const perms = await getPermissionsForSession(session);
  if (!perms["ui:validate-documents"]) {
    return {
      ok: false,
      error: "You do not have permission to validate sales invoices.",
    };
  }

  const createResult = await createSaleForSession(session, input);
  if (!createResult.ok) return createResult;

  const validateResult = await validateSaleForSession(session, createResult.id);
  if (!validateResult.ok) {
    return {
      ok: false,
      error: validateResult.error,
      saleId: createResult.id,
      invoiceNo: createResult.invoiceNo,
    };
  }

  return {
    ok: true,
    id: createResult.id,
    invoiceNo: createResult.invoiceNo,
    soldAtIso: createResult.soldAtIso,
    grossAmount: createResult.grossAmount,
    status: "VALIDATED",
  };
}

export async function previewPosTaxesForSession(
  session: AuthSession,
  customerId: string,
  transactionIso: string,
): Promise<{ ok: true; taxes: PosTaxPreviewRow[] } | { ok: false; error: string }> {
  const prisma = getPrismaClient();
  const actor = actorFromAuthSession(session);
  if (!actor?.isActive) return { ok: false, error: "Login required." };

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

export async function previewPosLineStockForSession(
  session: AuthSession,
  salesPointIdRaw: number,
  storageLocationIdRaw: number,
  productIdRaw: number,
): Promise<PosLineStockPreview> {
  const prisma = getPrismaClient();
  const actor = actorFromAuthSession(session);
  if (!actor?.isActive) return { ok: false, error: "Login required." };

  const salesPointId = salesPointIdRaw;
  const storageLocationId = storageLocationIdRaw;
  const productId = productIdRaw;
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

export async function previewPosUnitPriceForSession(
  session: AuthSession,
  input: {
    customerId?: string;
    productId: number;
    transactionIso: string;
    isBottle: boolean;
    disposition: string;
  },
): Promise<{ ok: true; unitPriceExTax: string } | { ok: false; error: string }> {
  const prisma = getPrismaClient();
  const actor = actorFromAuthSession(session);
  if (!actor?.isActive) return { ok: false, error: "Login required." };

  if (input.disposition === "PUBLIC_RELATION") {
    return { ok: true, unitPriceExTax: "0" };
  }

  const dateIso = normalizeIsoDateInput(input.transactionIso.trim()) ?? utcIsoDateToday();
  const soldAt = noonUtcFromIsoDate(dateIso);

  if (input.isBottle) {
    const r = await resolveBottledUnitPriceExTax(prisma, input.productId, soldAt);
    if (!r.ok) return r;
    return { ok: true, unitPriceExTax: r.unitPriceExTax.toString() };
  }

  const customerId = String(input.customerId ?? "").trim();
  if (!customerId) {
    return { ok: false, error: "Customer is required to resolve price." };
  }

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { customerTypeId: true },
  });
  if (!customer) return { ok: false, error: "Customer not found." };

  const r = await resolveUnitPriceExTax(
    prisma,
    input.productId,
    customer.customerTypeId,
    soldAt,
  );
  if (!r.ok) return r;
  return { ok: true, unitPriceExTax: r.unitPriceExTax.toString() };
}

export async function listAvailableDeliveryOrdersForSession(
  session: AuthSession,
  salesPointId: number,
): Promise<AvailableDeliveryOrderRow[]> {
  if (!Number.isFinite(salesPointId)) return [];

  const prisma = getPrismaClient();
  const actor = actorFromAuthSession(session);
  if (!actor?.isActive) return [];

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

export async function lookupDeliveryOrderForSession(
  session: AuthSession,
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
  const actor = actorFromAuthSession(session);
  if (!actor?.isActive) {
    return { ok: false, error: "Login required." };
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

export async function searchCustomersForSession(
  session: AuthSession,
  query: string,
  limit = 50,
): Promise<
  Array<{
    id: string;
    name: string;
    customerTypeId: string;
    taxRegimeId: string | null;
    vatApplies: boolean;
  }>
> {
  const prisma = getPrismaClient();
  const actor = actorFromAuthSession(session);
  if (!actor?.isActive) return [];

  const scope = resolveServiceScope(session);
  if (commercialServiceErrorForOperations(scope)) return [];

  const q = String(query ?? "").trim();
  const where = customerWhereForOperationalUI(scope);
  const rows = await prisma.customer.findMany({
    where: q
      ? {
          ...where,
          name: { contains: q, mode: "insensitive" },
        }
      : where,
    orderBy: { name: "asc" },
    take: limit,
    select: {
      id: true,
      name: true,
      customerTypeId: true,
      taxRegimeId: true,
      taxRegime: { select: { vatApplies: true } },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    customerTypeId: r.customerTypeId,
    taxRegimeId: r.taxRegimeId,
    vatApplies: r.taxRegime?.vatApplies ?? false,
  }));
}

export async function loadPosConfigForSession(session: AuthSession) {
  const prisma = getPrismaClient();
  const actor = actorFromAuthSession(session);
  if (!actor?.isActive) {
    throw new Error("Login required.");
  }

  const scope = resolveServiceScope(session);
  const csOpErr = commercialServiceErrorForOperations(scope);
  if (csOpErr) throw new Error(csOpErr);

  const workingMonth = await resolveWorkingMonthForSession(session);
  const [posConfig, paymentMethods, storageLocations, salesPoints] = await Promise.all([
    loadPosPageConfig(session, scope),
    ensureBuiltinPaymentMethods().then(() =>
      listPaymentMethodDefinitions({
        activeOnly: true,
        kinds: ["SIMPLE", "CHEQUE", "TRAITE"],
      }),
    ),
    prisma.storageLocation.findMany({
      where: session.salesPoint?.id
        ? { salesPointId: session.salesPoint.id }
        : undefined,
      orderBy: [{ salesPointId: "asc" }, { name: "asc" }],
      select: { id: true, salesPointId: true, name: true, isDefault: true },
      take: 1000,
    }),
    session.salesPoint
      ? Promise.resolve([session.salesPoint])
      : prisma.salesPoint.findMany({
          orderBy: { name: "asc" },
          select: { id: true, name: true },
          take: 200,
        }),
  ]);

  const effectiveSalesPointId = session.salesPoint?.id ?? null;
  const isBota =
    posConfig.botaSalesPointId != null &&
    effectiveSalesPointId === posConfig.botaSalesPointId;

  const dateBounds = workingMonth
    ? {
        minIso: firstDayOfCalendarMonth(
          workingMonth.calendarYear,
          workingMonth.calendarMonth,
        ),
        maxIso: lastDayOfCalendarMonth(
          workingMonth.calendarYear,
          workingMonth.calendarMonth,
        ),
      }
    : null;

  return {
    botaSalesPointId: posConfig.botaSalesPointId,
    bottleOilStoreLocationId: posConfig.bottleOilStoreLocationId,
    walkInCustomerId: posConfig.walkInCustomerId,
    rationCustomerId: posConfig.rationCustomerId,
    publicRelationCustomerId: posConfig.publicRelationCustomerId,
    looseProducts: posConfig.looseProducts,
    bottledProducts: posConfig.bottledProducts,
    salesPoints,
    storageLocations,
    paymentMethods: paymentMethods.map((m) => ({
      id: m.id,
      code: m.code,
      name: m.name,
      kind: m.kind,
    })),
    effectiveSalesPointId,
    isBota,
    workingMonth,
    transactionDateMinIso: dateBounds?.minIso ?? null,
    transactionDateMaxIso: dateBounds?.maxIso ?? null,
  };
}
