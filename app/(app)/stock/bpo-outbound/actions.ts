"use server";

import { assertPermissionKey } from "@/lib/access-control";
import { canValidateBpoDocuments } from "@/lib/auth-roles";
import { getServerSession } from "@/lib/auth-server";
import { salesPointErrorForResource } from "@/lib/auth-sales-point-scope";
import { allocateInvoiceNo } from "@/lib/invoice";
import {
  BpoStockInsufficientError,
  applyBpoStockDeduction,
  dQty,
  ensureBotaSalesPointId,
  money2,
  qty3,
} from "@/lib/bpo";
import {
  assertPostingPeriod,
  assertTransactionDateInWorkingMonth,
  getOpenFinancialYearPeriod,
  toOpenFinancialYearForPosting,
} from "@/lib/financial-year";
import { normalizeIsoDateInput, noonUtcFromIsoDate, utcIsoDateToday } from "@/lib/posting-calendar";
import { getPrismaClient } from "@/lib/prisma";
import { prismaRetry } from "@/lib/prisma-retry";
import { resolveVariantUnitPriceExTax } from "@/lib/pricing/resolve";
import { getOrInitCompanySettings } from "@/lib/settings";
import { VAT_TAX_CODE } from "@/lib/tax/constants";
import { legacyVatSnapshotFromResolved } from "@/lib/tax/resolve";
import { resolveTaxesForCustomer } from "@/lib/tax/resolve-customer";
import {
  BpoEmployeeCollectedProduct,
  BpoMovementStatus,
  BpoMovementType,
  CustomerType,
  PaymentMethod,
  Prisma,
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

type LineInput = { productVariantId: string; qtyUnits: string };
type PreparedBpoSaleLine = {
  productId: number;
  productVariantId: string;
  variantLabel: string;
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

async function nextVoucherNo(prisma: ReturnType<typeof getPrismaClient>) {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const prefix = `BPO-OUT-${date}`;
  const count = await prisma.bpoStockMovement.count({
    where: { voucherNo: { startsWith: prefix } },
  });
  return `${prefix}-${String(count + 1).padStart(4, "0")}`;
}

function parseLines(raw: string) {
  const parsed = JSON.parse(raw || "[]") as LineInput[];
  if (!Array.isArray(parsed) || parsed.length === 0) throw new Error("Add at least one line.");
  return parsed.map((l) => {
    const productVariantId = String(l.productVariantId ?? "").trim();
    const qtyUnits = qty3(dQty(l.qtyUnits));
    if (!productVariantId) throw new Error("Each line must have a variant.");
    if (qtyUnits.lte(0)) throw new Error("Quantity must be greater than zero.");
    return { productVariantId, qtyUnits };
  });
}

function parseDate(raw: string): Date {
  const s = String(raw ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(`${s}T00:00:00.000Z`);
  return new Date();
}

function revalidateBpo() {
  revalidatePath("/stock/bpo-outbound");
  revalidatePath("/reports/bpo");
  revalidatePath("/reports/bpo-stock-cross");
  revalidatePath("/reports/sales");
  revalidatePath("/pos");
}

async function ensureBpoSaleCustomer(
  prisma: ReturnType<typeof getPrismaClient>,
  kind: "cash" | "credit",
) {
  const name = kind === "cash" ? "BPO Cash Sales" : "BPO Employee Credit Sales";
  const customerType = kind === "cash" ? CustomerType.RETAIL : CustomerType.WORKER;
  const existing = await prisma.customer.findFirst({
    where: { name, customerType },
    select: { id: true, name: true, taxRegimeId: true },
  });
  if (existing) return existing;

  const taxRegime = await prisma.taxRegime.findFirst({
    orderBy: { name: "asc" },
    select: { id: true },
  });
  if (!taxRegime) {
    throw new Error("Create at least one tax regime before posting BPO sales.");
  }
  return prisma.customer.create({
    data: {
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

export async function createBpoOutboundMovement(formData: FormData): Promise<BpoOutboundResult> {
  const prisma = getPrismaClient();
  try {
    await assertPermissionKey("route:/stock/bpo-outbound");
    const { actor, session } = await requireActor(prisma);
    if (!canValidateBpoDocuments(session.role as UserRole)) {
      return { ok: false, error: "Only authorized supervisors/managers can post BPO outbound movements." };
    }
    const botaId = await ensureBotaSalesPointId(prisma);
    const accessErr = salesPointErrorForResource(actor, botaId);
    if (accessErr) return { ok: false, error: accessErr };
    const lines = parseLines(String(formData.get("lines") ?? "[]"));
    const variantRows = await prisma.productVariant.findMany({
      where: { id: { in: lines.map((l) => l.productVariantId) }, product: { isBottledPalmOil: true } },
      select: { id: true, name: true, product: { select: { productName: true } } },
    });
    const variantById = new Map(variantRows.map((v) => [v.id, v]));
    if (variantRows.length !== new Set(lines.map((l) => l.productVariantId)).size) {
      return { ok: false, error: "One or more lines are not Bottled Palm Oil variants." };
    }
    const reason = String(formData.get("reason") ?? "").trim() || "Gift";
    const note = String(formData.get("note") ?? "").trim() || null;
    const voucherNo = await nextVoucherNo(prisma);
    await prismaRetry(() =>
      prisma.$transaction(
        async (tx) => {
          await applyBpoStockDeduction(
            tx,
            botaId,
            lines.map((l) => {
              const v = variantById.get(l.productVariantId)!;
              return {
                productVariantId: l.productVariantId,
                qtyUnits: l.qtyUnits,
                label: `${v.product.productName} - ${v.name}`,
              };
            }),
          );
          await tx.bpoStockMovement.create({
            data: {
              movementType: reason.toLowerCase() === "gift" ? BpoMovementType.GIFT : BpoMovementType.OTHER_OUT,
              status: BpoMovementStatus.VALIDATED,
              voucherNo,
              sourceSalesPointId: botaId,
              movementDate: parseDate(String(formData.get("movementDate") ?? "")),
              reason,
              note,
              createdByUserId: actor.id,
              botaValidatedByUserId: actor.id,
              botaValidatedAt: new Date(),
              postedAt: new Date(),
              lines: {
                create: lines.map((l) => ({
                  productVariantId: l.productVariantId,
                  voucherQtyUnits: l.qtyUnits,
                  actualQtyUnits: l.qtyUnits,
                  postedQtyUnits: l.qtyUnits,
                })),
              },
            },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    );
    revalidateBpo();
    return { ok: true };
  } catch (e) {
    if (e instanceof BpoStockInsufficientError) return { ok: false, error: e.message };
    return { ok: false, error: e instanceof Error ? e.message : "Could not post outbound movement." };
  }
}

export async function createBpoOutboundSale(formData: FormData): Promise<BpoOutboundResult> {
  const prisma = getPrismaClient();
  try {
    await assertPermissionKey("route:/stock/bpo-outbound");
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
      const priced = await resolveVariantUnitPriceExTax(prisma, line.productVariantId, soldAt);
      if (!priced.ok) return { ok: false, error: priced.error };
      const unitPrice = money2(priced.unitPriceExTax);
      const lineNet = money2(line.qtyUnits.mul(unitPrice));
      net = net.add(lineNet);
      preparedLines.push({
        productId: priced.productId,
        productVariantId: line.productVariantId,
        variantLabel: `${priced.productName} - ${priced.variantName}`,
        qtyUnits: line.qtyUnits,
        unitPrice,
        lineNet,
      });
    }

    const customer = await ensureBpoSaleCustomer(
      prisma,
      paymentMode === "CREDIT" ? "credit" : "cash",
    );
    const resolved = await resolveTaxesForCustomer(prisma, customer.id, soldAt);
    if (!resolved.ok) return { ok: false, error: resolved.error };
    const appliedTaxCreates = resolved.taxes.map((tax) => ({
      taxTypeId: tax.taxTypeId,
      codeSnapshot: tax.code,
      labelSnapshot: tax.label,
      rateSnapshot: tax.rate,
      amount: money2(net.mul(tax.rate)),
    }));
    const totalTax = appliedTaxCreates.reduce(
      (acc, row) => acc.add(row.amount),
      new Prisma.Decimal(0),
    );
    const vatAmount = appliedTaxCreates
      .filter((row) => row.codeSnapshot === VAT_TAX_CODE)
      .reduce((acc, row) => acc.add(row.amount), new Prisma.Decimal(0));
    const { vatRateSnapshot } = legacyVatSnapshotFromResolved(resolved.taxes);
    const gross = money2(net.add(totalTax));

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

    const invoiceNo = await allocateInvoiceNo((await getOrInitCompanySettings()).invoicePrefix, soldAt);
    const created = await prismaRetry(() =>
      prisma.$transaction(
        async (tx) => {
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
              appliedTaxes: { create: appliedTaxCreates },
              lines: {
                create: preparedLines.map((line, idx) => {
                  const isLast = idx === preparedLines.length - 1;
                  const lineTax = isLast
                    ? money2(
                        totalTax.sub(
                          preparedLines
                            .slice(0, idx)
                            .reduce(
                              (acc, prior) =>
                                acc.add(
                                  net.lte(0)
                                    ? new Prisma.Decimal(0)
                                    : money2(prior.lineNet.div(net).mul(totalTax)),
                                ),
                              new Prisma.Decimal(0),
                            ),
                        ),
                      )
                    : net.lte(0)
                      ? new Prisma.Decimal(0)
                      : money2(line.lineNet.div(net).mul(totalTax));
                  return {
                    productId: line.productId,
                    productVariantId: line.productVariantId,
                    qtyKg: new Prisma.Decimal(0),
                    qtyUnits: line.qtyUnits,
                    unitPricePerKg: line.unitPrice,
                    unitPricePerUnit: line.unitPrice,
                    lineNet: line.lineNet,
                    lineVat: lineTax,
                    lineGross: money2(line.lineNet.add(lineTax)),
                  };
                }),
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
            include: {
              lines: {
                include: {
                  product: { select: { productName: true } },
                  productVariant: { select: { name: true } },
                },
              },
            },
          });

          await applyBpoStockDeduction(
            tx,
            botaId,
            sale.lines.map((line) => {
              if (!line.productVariantId || !line.qtyUnits) {
                throw new Error("Bottled Palm Oil sale line is missing variant quantity.");
              }
              return {
                saleLineId: line.id,
                productVariantId: line.productVariantId,
                qtyUnits: line.qtyUnits,
                label: `${line.product.productName}${line.productVariant ? ` - ${line.productVariant.name}` : ""}`,
              };
            }),
          );

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
                productVariantId:
                  preparedLines.length === 1 ? preparedLines[0]!.productVariantId : null,
                rationPeriodYear: postingCalendarYear,
                rationPeriodMonth: postingCalendarMonth,
              },
            });
          }

          return { id: sale.id, invoiceNo: sale.invoiceNo };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    );

    revalidateBpo();
    revalidatePath(`/sales/${created.id}`);
    return { ok: true, id: created.id, invoiceNo: created.invoiceNo };
  } catch (e) {
    if (e instanceof BpoStockInsufficientError) return { ok: false, error: e.message };
    return { ok: false, error: e instanceof Error ? e.message : "Could not post BPO sale." };
  }
}

export async function loadBpoOutboundSaleReceipt(
  saleId: string,
): Promise<BpoOutboundSaleReceiptResult> {
  const prisma = getPrismaClient();
  try {
    await assertPermissionKey("route:/stock/bpo-outbound");
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
          where: { product: { isBottledPalmOil: true } },
          include: {
            productVariant: {
              select: { name: true, product: { select: { productName: true } } },
            },
          },
          orderBy: { id: "asc" },
        },
      },
    });
    if (!sale || sale.lines.length === 0) {
      return { ok: false, error: "BPO sale receipt not found." };
    }
    const accessErr = salesPointErrorForResource(actor, sale.salesPointId ?? null);
    if (accessErr) return { ok: false, error: accessErr };

    const employee = sale.bpoEmployeeCreditSale?.employee;
    return {
      ok: true,
      data: {
        companyName: settings.companyName,
        department: settings.department ?? null,
        companyPhone: settings.phone ?? null,
        companyAddress: settings.address ?? null,
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
          variantLabel: line.productVariant
            ? `${line.productVariant.product.productName} - ${line.productVariant.name}`
            : "Bottled Palm Oil",
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
