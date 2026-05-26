"use server";

import { assertPermissionKey } from "@/lib/access-control";
import { canValidateBpoDocuments } from "@/lib/auth-roles";
import { getServerSession } from "@/lib/auth-server";
import { salesPointErrorForResource } from "@/lib/auth-sales-point-scope";
import { allocateInvoiceNo } from "@/lib/invoice";
import { dQty, ensureBotaSalesPointId, money2, qty3 } from "@/lib/bpo";
import {
  assertPostingPeriod,
  assertTransactionDateInWorkingMonth,
  getOpenFinancialYearPeriod,
  toOpenFinancialYearForPosting,
} from "@/lib/financial-year";
import { normalizeIsoDateInput, noonUtcFromIsoDate, utcIsoDateToday } from "@/lib/posting-calendar";
import { getPrismaClient } from "@/lib/prisma";
import { prismaRetry } from "@/lib/prisma-retry";
import { resolveBottledUnitPriceExTax } from "@/lib/pricing/resolve";
import { getOrInitCompanySettings } from "@/lib/settings";
import { resolveCommercialServiceForUserId } from "@/lib/commercial-service";
import { taxRegimeWhereForCommercialLine } from "@/lib/service-scope";
import { isInsufficientStockError } from "@/lib/stock/errors";
import { applyMovement } from "@/lib/stock/post";
import {
  BpoEmployeeCollectedProduct,
  CustomerType,
  PaymentMethod,
  Prisma,
  StockMovementKind,
  UserRole,
  ValidationStatus,
} from "@prisma/client";
import { revalidatePath } from "next/cache";

export type BpoOutboundResult =
  | { ok: true; id?: string; invoiceNo?: string }
  | { ok: false; error: string };

export type BpoOutboundSaleReceiptPayload = {
  companyName: string;
  department: string | null;
  companyPhone: string | null;
  companyAddress: string | null;
  invoiceNo: string;
  soldAtIso: string;
  customerName: string;
  paymentMethod: PaymentMethod;
  employeeLabel: string | null;
  netAmount: string;
  grossAmount: string;
  taxLines: Array<{
    label: string;
    ratePercentLabel: string;
    amount: string;
  }>;
  lines: Array<{
    id: string;
    variantLabel: string;
    qtyUnits: string;
    unitPricePerUnit: string;
    lineNet: string;
    lineGross: string;
  }>;
};

export type BpoOutboundSaleReceiptResult =
  | { ok: true; data: BpoOutboundSaleReceiptPayload }
  | { ok: false; error: string };

type LineInput = { productId: string; qtyUnits: string };
type PreparedBpoSaleLine = {
  productId: number;
  productLabel: string;
  qtyUnits: Prisma.Decimal;
  unitPrice: Prisma.Decimal;
  lineNet: Prisma.Decimal;
};

async function requireActor(prisma: ReturnType<typeof getPrismaClient>) {
  const session = await getServerSession();
  if (!session?.userId) throw new Error("Login required.");
  const actor = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, role: true, salesPointId: true, isActive: true },
  });
  if (!actor?.isActive) throw new Error("Login required.");
  return { session, actor };
}

function parseLines(raw: string) {
  const parsed = JSON.parse(raw || "[]") as LineInput[];
  if (!Array.isArray(parsed) || parsed.length === 0) throw new Error("Add at least one line.");
  return parsed.map((l) => {
    const productIdRaw = String(l.productId ?? (l as { productVariantId?: string }).productVariantId ?? "").trim();
    const productId = Number.parseInt(productIdRaw, 10);
    const qtyUnits = qty3(dQty(l.qtyUnits));
    if (!Number.isFinite(productId)) throw new Error("Each line must have a product.");
    if (qtyUnits.lte(0)) throw new Error("Quantity must be greater than zero.");
    return { productId, qtyUnits };
  });
}

function revalidateBpo() {
  revalidatePath("/bpo-sales");
  revalidatePath("/reports/bpo");
  revalidatePath("/reports/sales");
  revalidatePath("/pos");
}

async function ensureBpoSaleCustomer(
  prisma: ReturnType<typeof getPrismaClient>,
  kind: "cash" | "credit",
  commercialServiceId: string,
) {
  const name = kind === "cash" ? "BPO Cash Sales" : "BPO Employee Credit Sales";
  const customerType = kind === "cash" ? CustomerType.RETAIL : CustomerType.WORKER;
  const existing = await prisma.customer.findFirst({
    where: { name, customerType, commercialServiceId },
    select: { id: true, name: true, taxRegimeId: true },
  });
  if (existing) return existing;

  const taxRegime = await prisma.taxRegime.findFirst({
    where: taxRegimeWhereForCommercialLine(commercialServiceId),
    orderBy: { name: "asc" },
    select: { id: true },
  });
  if (!taxRegime) {
    throw new Error("Create at least one tax regime for this commercial line before posting BPO sales.");
  }
  return prisma.customer.create({
    data: {
      commercialServiceId,
      name,
      customerType,
      taxRegimeId: taxRegime.id,
      hasTaxpayerId: false,
    },
    select: { id: true, name: true, taxRegimeId: true },
  });
}

function parsePostingNumber(formData: FormData, key: string) {
  return Number.parseInt(String(formData.get(key) ?? "").trim(), 10);
}

function saleDateFromForm(formData: FormData) {
  const raw = String(formData.get("saleDate") ?? formData.get("movementDate") ?? "").trim();
  const iso = normalizeIsoDateInput(raw) ?? utcIsoDateToday();
  return noonUtcFromIsoDate(iso);
}

export async function createBpoOutboundSale(formData: FormData): Promise<BpoOutboundResult> {
  const prisma = getPrismaClient();
  try {
    await assertPermissionKey("route:/bpo-sales");
    const { actor, session } = await requireActor(prisma);
    if (!canValidateBpoDocuments(session.role as UserRole)) {
      return { ok: false, error: "Only authorized supervisors/managers can post BPO sales." };
    }

    const botaId = await ensureBotaSalesPointId(prisma);
    const accessErr = salesPointErrorForResource(actor, botaId);
    if (accessErr) return { ok: false, error: accessErr };

    const paymentMode = String(formData.get("paymentMode") ?? "").trim();
    if (paymentMode !== "CASH" && paymentMode !== "CREDIT") {
      return { ok: false, error: "Select cash or employee credit sale." };
    }

    const collectedProductRaw = String(formData.get("collectedProduct") ?? "BOTTLED_PALM_OIL");
    const collectedProduct =
      collectedProductRaw === BpoEmployeeCollectedProduct.LOOSE_PALM_OIL
        ? BpoEmployeeCollectedProduct.LOOSE_PALM_OIL
        : BpoEmployeeCollectedProduct.BOTTLED_PALM_OIL;
    if (collectedProduct !== BpoEmployeeCollectedProduct.BOTTLED_PALM_OIL) {
      return {
        ok: false,
        error: "Loose Palm Oil employee credit capture is reserved for the loose palm oil sales flow.",
      };
    }

    const soldAt = saleDateFromForm(formData);
    const postingFY = parsePostingNumber(formData, "postingFinancialYear");
    const postingCalendarYear = parsePostingNumber(formData, "postingCalendarYear");
    const postingCalendarMonth = parsePostingNumber(formData, "postingCalendarMonth");
    const openPeriod = await getOpenFinancialYearPeriod();
    if (!openPeriod) return { ok: false, error: "No financial year is open." };
    const open = toOpenFinancialYearForPosting(openPeriod);
    assertPostingPeriod(open, postingFY, postingCalendarYear, postingCalendarMonth);
    assertTransactionDateInWorkingMonth(open, soldAt, postingCalendarYear, postingCalendarMonth);

    const lines = parseLines(String(formData.get("lines") ?? "[]"));
    const preparedLines: PreparedBpoSaleLine[] = [];
    let net = new Prisma.Decimal(0);
    for (const line of lines) {
      const priced = await resolveBottledUnitPriceExTax(prisma, line.productId, soldAt);
      if (!priced.ok) return { ok: false, error: priced.error };
      const unitPrice = money2(priced.unitPriceExTax);
      const lineNet = money2(line.qtyUnits.mul(unitPrice));
      net = net.add(lineNet);
      preparedLines.push({
        productId: priced.productId,
        productLabel: priced.productName,
        qtyUnits: line.qtyUnits,
        unitPrice,
        lineNet,
      });
    }

    const commercialService = await resolveCommercialServiceForUserId(prisma, actor.id);

    const customer = await ensureBpoSaleCustomer(
      prisma,
      paymentMode === "CREDIT" ? "credit" : "cash",
      commercialService.id,
    );
    const vatAmount = new Prisma.Decimal(0);
    const vatRateSnapshot = new Prisma.Decimal(0);
    const gross = money2(net);

    const employeeMatricule = String(formData.get("employeeMatricule") ?? "").trim();
    const employeeName = String(formData.get("employeeName") ?? "").trim();
    const employeeEstate = String(formData.get("employeeEstate") ?? "").trim();
    if (paymentMode === "CREDIT") {
      if (!employeeMatricule || !employeeName || !employeeEstate) {
        return {
          ok: false,
          error: "Employee matricule, name, and estate are required for credit sales.",
        };
      }
    }

    const created = await prismaRetry(() =>
      prisma.$transaction(
        async (tx) => {
          const invoiceNo = await allocateInvoiceNo(tx, commercialService.id, soldAt);
          const sale = await tx.sale.create({
            data: {
              invoiceNo,
              soldAt,
              referenceNumber:
                paymentMode === "CREDIT" ? `Employee credit ${employeeMatricule}` : "BPO cash sale",
              salesPointId: botaId,
              customerId: customer.id,
              vehicleNumber: "BPO-OUTBOUND",
              dateIssued: soldAt,
              createdByUserId: actor.id,
              status: ValidationStatus.VALIDATED,
              validatedAt: new Date(),
              validatedByUserId: actor.id,
              customerNameSnapshot:
                paymentMode === "CREDIT" ? `Employee Credit - ${employeeName}` : customer.name,
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
              lines: {
                create: preparedLines.map((line) => ({
                  productId: line.productId,
                  qtyKg: new Prisma.Decimal(0),
                  qtyUnits: line.qtyUnits,
                  unitPricePerKg: line.unitPrice,
                  unitPricePerUnit: line.unitPrice,
                  lineNet: line.lineNet,
                  lineVat: new Prisma.Decimal(0),
                  lineGross: line.lineNet,
                })),
              },
              payments: {
                create: {
                  method:
                    paymentMode === "CREDIT" ? PaymentMethod.CREDIT : PaymentMethod.CASH,
                  amount: gross,
                  paidAt: soldAt,
                },
              },
            },
            select: { id: true, invoiceNo: true },
          });

          if (paymentMode === "CREDIT") {
            const employee = await tx.employee.upsert({
              where: { matricule: employeeMatricule },
              create: {
                matricule: employeeMatricule,
                name: employeeName,
                estate: employeeEstate,
              },
              update: {
                name: employeeName,
                estate: employeeEstate,
                isActive: true,
              },
              select: { id: true },
            });
            await tx.bpoEmployeeCreditSale.create({
              data: {
                saleId: sale.id,
                employeeId: employee.id,
                collectedProduct,
                productId: preparedLines.length === 1 ? preparedLines[0]!.productId : null,
                rationPeriodYear: postingCalendarYear,
                rationPeriodMonth: postingCalendarMonth,
              },
            });
          }

          for (const line of preparedLines) {
            await applyMovement(tx, {
              salesPointId: botaId,
              productId: line.productId,
              qty: line.qtyUnits,
              kind: StockMovementKind.SALE,
              occurredAt: soldAt,
              userId: actor.id,
              sourceKind: "SALE",
              sourceId: sale.id,
            });
          }

          return { id: sale.id, invoiceNo: sale.invoiceNo };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    );

    revalidateBpo();
    revalidatePath(`/sales/${created.id}`);
    revalidatePath("/stock");
    return { ok: true, id: created.id, invoiceNo: created.invoiceNo };
  } catch (e) {
    if (isInsufficientStockError(e)) {
      return { ok: false, error: e.message };
    }
    return { ok: false, error: e instanceof Error ? e.message : "Could not post BPO sale." };
  }
}

export async function loadBpoOutboundSaleReceipt(
  saleId: string,
): Promise<BpoOutboundSaleReceiptResult> {
  const prisma = getPrismaClient();
  try {
    await assertPermissionKey("route:/bpo-sales");
    const { actor } = await requireActor(prisma);
    const settings = await getOrInitCompanySettings();
    const sale = await prisma.sale.findUnique({
      where: { id: String(saleId ?? "").trim() },
      include: {
        payments: { orderBy: { id: "asc" } },
        appliedTaxes: { orderBy: { id: "asc" } },
        bpoEmployeeCreditSale: {
          include: {
            employee: { select: { matricule: true, name: true, estate: true } },
          },
        },
        lines: {
          where: { product: { form: "BOTTLED" } },
          include: {
            product: { select: { productName: true } },
          },
          orderBy: { id: "asc" },
        },
      },
    });
    if (!sale || sale.lines.length === 0) {
      return { ok: false, error: "BPO sale receipt not found." };
    }
    if (sale.vehicleNumber !== "BPO-OUTBOUND") {
      return { ok: false, error: "BPO sale receipt not found." };
    }
    const accessErr = salesPointErrorForResource(actor, sale.salesPointId ?? null);
    if (accessErr) return { ok: false, error: accessErr };

    const employee = sale.bpoEmployeeCreditSale?.employee;
    const deptParts = [
      settings.department?.trim(),
      sale.commercialServiceNameSnapshot?.trim(),
    ].filter((s): s is string => Boolean(s && s.length > 0));
    return {
      ok: true,
      data: {
        companyName: settings.companyName,
        department: deptParts.length > 0 ? deptParts.join(" · ") : null,
        companyPhone: sale.issuerPhoneSnapshot ?? null,
        companyAddress: sale.issuerAddressSnapshot ?? null,
        invoiceNo: sale.invoiceNo,
        soldAtIso: sale.soldAt.toISOString(),
        customerName: sale.customerNameSnapshot,
        paymentMethod: sale.payments.some((p) => p.method === PaymentMethod.CREDIT)
          ? PaymentMethod.CREDIT
          : PaymentMethod.CASH,
        employeeLabel: employee
          ? `${employee.matricule} · ${employee.name} · ${employee.estate}`
          : null,
        netAmount: sale.netAmount.toString(),
        grossAmount: sale.grossAmount.toString(),
        taxLines: sale.appliedTaxes.map((tax) => ({
          label: tax.labelSnapshot,
          ratePercentLabel: new Prisma.Decimal(tax.rateSnapshot.toString())
            .mul(100)
            .toDecimalPlaces(2)
            .toString(),
          amount: tax.amount.toString(),
        })),
        lines: sale.lines.map((line) => ({
          id: line.id,
          variantLabel: line.product.productName,
          qtyUnits: line.qtyUnits?.toString() ?? "0",
          unitPricePerUnit: line.unitPricePerUnit?.toString() ?? line.unitPricePerKg.toString(),
          lineNet: line.lineNet.toString(),
          lineGross: line.lineGross.toString(),
        })),
      },
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not load BPO sale receipt.",
    };
  }
}
