import fs from "fs";

const header = `import "server-only";

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
import { saleValidationScopeError } from "@/lib/pos/sale-validation-scope";
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
import { effectiveSessionRole } from "@/lib/auth-roles";
import { getPrismaClient } from "@/lib/prisma";
import { validateSaleForSession } from "@/lib/services/mobile-pending-sales";
import {
  Prisma,
  PosSaleDisposition,
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

`;

const footer = `
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
    message = \`This location holds \${breakdown.unsellableQty.toString()} kg unsellable stock for this product. Sales from this location are not allowed.\`;
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
`;

const src = fs.readFileSync("app/(app)/pos/actions.ts", "utf8");
const start = src.indexOf("export async function createSale");
const end = src.indexOf("export async function previewPosTaxes");
let body = src.slice(start, end);

body = body.replace(
  "export async function createSale(formData: FormData): Promise<SaveSaleResult> {",
  "export async function createSaleForSession(session: AuthSession, input: CreateSaleInput): Promise<SaveSaleResult> {",
);

const inputBlock = `const prisma = getPrismaClient();
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
  const soldAt = noonUtcFromIsoDate(transactionIso);`;

const oldStart = body.indexOf("const prisma = getPrismaClient();");
const oldEnd = body.indexOf("const resolvedWorkingMonth = await resolveWorkingMonthForSession(session);");
if (oldStart === -1 || oldEnd === -1) {
  console.error("Could not find replacement anchors");
  process.exit(1);
}
body = body.slice(0, oldStart) + inputBlock + "\n\n  " + body.slice(oldEnd);

body = body.replace(/\n  revalidatePath\([^)]+\);/g, "");
body = body.replace(
  "return { ok: true, id: created.id, invoiceNo: created.invoiceNo, soldAtIso: created.soldAt.toISOString() };",
  "return { ok: true, id: created.id, invoiceNo: created.invoiceNo, soldAtIso: created.soldAt.toISOString(), grossAmount: gross.toString() };",
);

fs.writeFileSync("lib/services/pos-sales.ts", header + body + footer);
console.log("Wrote lib/services/pos-sales.ts");
