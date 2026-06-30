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
import { resolveWorkingMonthForSession } from "@/lib/sales-point-working-month";
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
import { canPickPendingPosSales, effectiveSessionRole } from "@/lib/auth-roles";
import { actorRequiresFixedPostingSite } from "@/lib/sales-point-assignment";
import type { UserRole as AppUserRole } from "@/lib/domain";
import { getServerSession } from "@/lib/auth-server";
import {
  fetchActorSalesPointScope,
  salesPointErrorForResource,
  salesPointErrorForSubmitted,
} from "@/lib/auth-sales-point-scope";
import { assertCustomerSelectableForOperations } from "@/lib/customers/operational-customer-scope";
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
  resolveBottleOilStoreLocationId,
  WALK_IN_CUSTOMER_NAME,
} from "@/lib/pos/sale-product-mode";
import { runValidatePosSale } from "@/lib/pos/validate-pos-sale";
import {
  createSaleForSession,
  createSaleInputFromFormData,
  listAvailableDeliveryOrdersForSession,
  lookupDeliveryOrderForSession,
  previewPosLineStockForSession,
  previewPosTaxesForSession,
  type PosLineStockPreview,
  type PosTaxPreviewRow,
  type SaveSaleResult,
} from "@/lib/services/pos-sales";
import type {
  AvailableDeliveryOrderRow,
  LoadedSaleView,
  PendingSaleRow,
  SaleMutationResult,
  SalePrintPayload,
} from "./types";
import {
  pendingSalesPointFilter,
  saleValidationScopeError,
} from "@/lib/pos/sale-validation-scope";
import { getCustomerTypeIdByCode } from "@/lib/customer-types/catalog";
import { resolveBottledUnitPriceExTax, resolveUnitPriceExTax } from "@/lib/pricing/resolve";
import { isInsufficientStockError } from "@/lib/stock/errors";
import {
  assertPosLocationSellable,
  assertPosSellableQtyAvailable,
  getLocationStockBreakdown,
  isPosLocationBlockedByUnsellableStock,
} from "@/lib/stock/pos-location";
import {
  assertPaymentMethodUsable,
  validatePaymentFields,
} from "@/lib/payment-methods/catalog";
import type { PaymentMethodKind } from "@/lib/payment-methods/types";
import {
  Prisma,
  PosSaleDisposition,
  PosSaleProductMode,
  ValidationStatus,
  UserRole,
} from "@prisma/client";
import { revalidatePath } from "next/cache";

function formatPrintQty(value: Prisma.Decimal): string {
  const s = value.toDecimalPlaces(3).toString();
  if (!s.includes(".")) return s;
  const trimmed = s.replace(/0+$/, "").replace(/\.$/, "");
  return trimmed || "0";
}

function saleLineUsesUnits(
  saleProductMode: PosSaleProductMode | null,
  line: { qtyUnits: Prisma.Decimal | null; qtyKg: Prisma.Decimal },
): boolean {
  if (saleProductMode === PosSaleProductMode.BOTTLE) return true;
  return line.qtyUnits != null && line.qtyUnits.gt(0);
}

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
  const actor = await fetchActorSalesPointScope(prisma, session.userId);
  if (!actor?.isActive) {
    throw new Error("Login required.");
  }
  return { session, actor };
}

export async function createSale(formData: FormData): Promise<SaveSaleResult> {
  try {
    await assertPermissionKey("route:/pos");
    const session = await getServerSession();
    if (!session?.userId) return { ok: false, error: "Login required." };
    const result = await createSaleForSession(
      session,
      createSaleInputFromFormData(formData),
    );
    if (result.ok) {
      revalidatePath("/pos");
      revalidatePath("/dashboard");
    }
    return result;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Login required." };
  }
}

export async function previewPosTaxes(
  customerId: string,
  transactionIso: string,
): Promise<{ ok: true; taxes: PosTaxPreviewRow[] } | { ok: false; error: string }> {
  try {
    await assertPermissionKey("route:/pos");
    const session = await getServerSession();
    if (!session?.userId) return { ok: false, error: "Login required." };
    return previewPosTaxesForSession(session, customerId, transactionIso);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Login required." };
  }
}

export async function previewPosLineStock(
  salesPointIdRaw: string,
  storageLocationIdRaw: string,
  productIdRaw: string,
): Promise<PosLineStockPreview> {
  try {
    await assertPermissionKey("route:/pos");
    const session = await getServerSession();
    if (!session?.userId) return { ok: false, error: "Login required." };
    return previewPosLineStockForSession(
      session,
      Number.parseInt(String(salesPointIdRaw ?? "").trim(), 10),
      Number.parseInt(String(storageLocationIdRaw ?? "").trim(), 10),
      Number.parseInt(String(productIdRaw ?? "").trim(), 10),
    );
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Login required." };
  }
}

function money2Print(value: Prisma.Decimal) {
  return value.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

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
      role: effectiveSessionRole(session),
      commercialServiceRoleCode: session.commercialServiceRole?.code,
    })
  ) {
    return [];
  }

  const scope = resolveServiceScope(session);
  if (commercialServiceErrorForOperations(scope)) return [];

  const botaSalesPointId = await resolveBotaSalesPointId(prisma);
  const validatorCtx = {
    role: effectiveSessionRole(session),
    commercialServiceRoleCode: session.commercialServiceRole?.code,
  };
  const salesPointFilter = pendingSalesPointFilter(
    botaSalesPointId,
    validatorCtx,
    actor.salesPointId,
    actorRequiresFixedPostingSite(actor),
  );

  const rows = await prisma.sale.findMany({
    where: mergeWhereWithServiceScope(
      {
        status: ValidationStatus.PENDING,
        ...salesPointFilter,
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
      payments: {
        orderBy: { id: "asc" },
        include: {
          paymentMethod: { select: { id: true, code: true, name: true, kind: true } },
        },
      },
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
    customerName: row.customerNameSnapshot,
    saleProductMode: row.saleProductMode,
    saleDisposition: row.saleDisposition,
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
      paymentMethodId: p.paymentMethod.id,
      methodCode: p.paymentMethod.code,
      methodName: p.paymentMethod.name,
      kind: p.paymentMethod.kind as PaymentMethodKind,
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

export async function listAvailableDeliveryOrdersForSale(
  salesPointIdRaw: string,
): Promise<AvailableDeliveryOrderRow[]> {
  const salesPointId = Number.parseInt(String(salesPointIdRaw ?? "").trim(), 10);
  if (!Number.isFinite(salesPointId)) return [];
  try {
    await assertPermissionKey("route:/pos");
    const session = await getServerSession();
    if (!session?.userId) return [];
    return listAvailableDeliveryOrdersForSession(session, salesPointId);
  } catch {
    return [];
  }
}

export async function lookupDeliveryOrderForSale(
  rawNo: string,
  selectedCustomerId: string,
): Promise<
  | { ok: true; data: DeliveryOrderLookupDto & { customerMatches: boolean } }
  | { ok: false; error: string }
> {
  try {
    await assertPermissionKey("route:/pos");
    const session = await getServerSession();
    if (!session?.userId) return { ok: false, error: "Login required." };
    return lookupDeliveryOrderForSession(session, rawNo, selectedCustomerId);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Login required." };
  }
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
      id: true,
      status: true,
      salesPointId: true,
      commercialServiceId: true,
      deliveryOrderNo: true,
      saleProductMode: true,
      saleDisposition: true,
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

  const botaSalesPointId = await resolveBotaSalesPointId(prisma);
  const scopeErr = saleValidationScopeError(
    existing.salesPointId,
    botaSalesPointId,
    {
      role: effectiveSessionRole(session),
      commercialServiceRoleCode: session.commercialServiceRole?.code,
    },
  );
  if (scopeErr) return { ok: false, error: scopeErr };

  const result = await runValidatePosSale(prisma, existing, session.userId);
  if (!result.ok) return result;

  revalidatePath("/pos");
  revalidatePath(`/sales/${id}`);
  revalidatePath("/dashboard");
  revalidatePath("/stock");
  return { ok: true };
}

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
      payments: {
        orderBy: { id: "asc" },
        include: {
          paymentMethod: { select: { name: true, kind: true } },
        },
      },
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

  const isBottleSale = sale.saleProductMode === PosSaleProductMode.BOTTLE;
  const saleDisposition = sale.saleDisposition;
  const isWalkInCustomer =
    sale.customer.name.trim().toLowerCase() ===
    WALK_IN_CUSTOMER_NAME.toLowerCase();
  const vehicleNumber =
    sale.vehicleNumber === BOTTLE_VEHICLE_PLACEHOLDER
      ? null
      : sale.vehicleNumber;

  const saleModel: SalePrintModel = {
    invoiceNo: sale.invoiceNo,
    status: sale.status,
    soldAtIso: sale.soldAt.toISOString(),
    vehicleNumber,
    dateIssuedIso: (sale.dateIssued ?? sale.soldAt).toISOString(),
    deliveryOrderNo: sale.deliveryOrderNo,
    customerName: sale.customerNameSnapshot.trim(),
    isWalkInCustomer,
    taxpayerId: sale.customer.taxpayerId,
    vatApplies: vatAppliesSnapshot,
    isBottleSale,
    saleDisposition,
    appliedTaxLines,
    lines: sale.lines.map((l, idx) => {
      const useUnits = saleLineUsesUnits(sale.saleProductMode, l);
      return {
        lineNo: idx + 1,
        productName: l.product.productName,
        productCat: l.product.productCat.productCat,
        qty: useUnits
          ? formatPrintQty(l.qtyUnits ?? l.qtyKg)
          : formatPrintQty(l.qtyKg),
        unitPrice: useUnits
          ? (l.unitPricePerUnit ?? l.unitPricePerKg).toString()
          : l.unitPricePerKg.toString(),
        lineNet: l.lineNet.toString(),
      };
    }),
    netAmount: sale.netAmount.toString(),
    vatAmount: sale.vatAmount.toString(),
    grossAmount: sale.grossAmount.toString(),
    payments: sale.payments.map((p) => ({
      methodName: p.paymentMethod.name,
      kind: p.paymentMethod.kind,
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
