"use server";

import { assertPermissionKey } from "@/lib/access-control";
import { canValidateBpoDocuments, roleMayRaiseBpoConsignmentSenderVoucher } from "@/lib/auth-roles";
import { getServerSession } from "@/lib/auth-server";
import {
  salesPointErrorForResource,
  salesPointErrorForSubmitted,
} from "@/lib/auth-sales-point-scope";
import { dQty, ensureBotaSalesPointId, qty3 } from "@/lib/bpo";
import {
  assertAvailableForTransfer,
  postTransferReceiverValidation,
  postTransferSenderValidation,
  reverseTransferSenderPosting,
  StockInsufficientError,
} from "@/lib/stock-ledger";
import { getPrismaClient } from "@/lib/prisma";
import { prismaRetry } from "@/lib/prisma-retry";
import {
  Prisma,
  StockMovementStatus,
  StockMovementType,
  UserRole,
  ValidationStatus,
} from "@prisma/client";
import { revalidateStockPaths } from "@/lib/stock-revalidate";
import type { UserRole as AppUserRole } from "@/lib/domain";

export type StockMovementMutationResult =
  | { ok: true; id?: string; voucherNo?: string }
  | { ok: false; error: string };

export type StockTransferPrintPayload = {
  id: string;
  voucherNo: string;
  status: StockMovementStatus;
  movementDateIso: string;
  sourceSalesPointName: string;
  destinationSalesPointName: string;
  note: string | null;
  discrepancyNote: string | null;
  createdByName: string;
  senderValidatedByName: string | null;
  receiverValidatedByName: string | null;
  senderValidatedAtIso: string | null;
  receiverValidatedAtIso: string | null;
  postedAtIso: string | null;
  lines: Array<{
    id: string;
    productLabel: string;
    voucherQty: string;
    actualQty: string | null;
    postedQty: string | null;
  }>;
};

export type StockTransferPrintResult =
  | { ok: true; data: StockTransferPrintPayload }
  | { ok: false; error: string };

type VoucherLineInput = { productId: string; qtyUnits: string; actualQty?: string };

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

function parseDate(raw: string): Date {
  const s = String(raw ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(`${s}T00:00:00.000Z`);
  return new Date();
}

function endOfUtcDate(date: Date): Date {
  const iso = date.toISOString().slice(0, 10);
  return new Date(`${iso}T23:59:59.999Z`);
}

async function nextVoucherNo(prisma: ReturnType<typeof getPrismaClient>) {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const prefix = `BPO-${date}`;
  const count = await prisma.stockMovement.count({
    where: { voucherNo: { startsWith: prefix } },
  });
  return `${prefix}-${String(count + 1).padStart(4, "0")}`;
}

function parseLines(raw: string): Array<{ productId: number; qtyUnits: Prisma.Decimal; actualQty?: Prisma.Decimal }> {
  const parsed = JSON.parse(raw || "[]") as VoucherLineInput[];
  if (!Array.isArray(parsed) || parsed.length === 0) throw new Error("Add at least one line.");
  return parsed.map((l) => {
    const productId = Number.parseInt(
      String(l.productId ?? (l as { productVariantId?: string }).productVariantId ?? ""),
      10,
    );
    if (!Number.isFinite(productId)) throw new Error("Each line must have a product.");
    const qtyUnits = qty3(dQty(l.qtyUnits));
    if (qtyUnits.lte(0)) throw new Error("Quantity must be greater than zero.");
    const actualRaw = String(l.actualQty ?? "").trim();
    const actualQty = actualRaw ? qty3(dQty(actualRaw)) : undefined;
    if (actualQty && actualQty.lt(0)) throw new Error("Actual quantity cannot be negative.");
    return { productId, qtyUnits, actualQty };
  });
}

async function assertBpoAvailability(
  prisma: ReturnType<typeof getPrismaClient> | Prisma.TransactionClient,
  salesPointId: number,
  lines: Array<{ productId: number; qtyUnits: Prisma.Decimal }>,
  _movementDate: Date,
  excludeMovementId?: string,
) {
  const productIds = [...new Set(lines.map((l) => l.productId))];
  const products = await prisma.product.findMany({
    where: { productId: { in: productIds }, form: "BOTTLED" },
    select: { productId: true, productName: true },
  });
  const byId = new Map(products.map((p) => [p.productId, p]));
  const transferLines = lines.map((l) => {
    const p = byId.get(l.productId);
    if (!p) throw new Error("Product not found.");
    return {
      item: { productId: l.productId },
      qty: l.qtyUnits,
      label: p.productName,
    };
  });
  try {
    await assertAvailableForTransfer(
      prisma,
      salesPointId,
      transferLines,
      excludeMovementId,
    );
    return null;
  } catch (e) {
    if (e instanceof StockInsufficientError) return e.message;
    throw e;
  }
}

function revalidateStock() {
  revalidateStockPaths();
}

function canValidateBotaConsignment(role: UserRole) {
  return (
    role === UserRole.ADMIN ||
    role === UserRole.MANAGER ||
    role === UserRole.SENIOR_SUPERVISOR
  );
}

function mapBpoPrintPayload(
  movement: NonNullable<Awaited<ReturnType<typeof loadBpoPrintMovement>>>,
): StockTransferPrintPayload {
  return {
    id: movement.id,
    voucherNo: movement.voucherNo,
    status: movement.status,
    movementDateIso: movement.movementDate.toISOString().slice(0, 10),
    sourceSalesPointName: movement.sourceSalesPoint?.name ?? "-",
    destinationSalesPointName: movement.destinationSalesPoint?.name ?? "-",
    note: movement.note,
    discrepancyNote: movement.discrepancyNote,
    createdByName: movement.createdBy.name,
    senderValidatedByName: movement.senderValidatedBy?.name ?? null,
    receiverValidatedByName: movement.receiverValidatedBy?.name ?? null,
    senderValidatedAtIso: movement.senderValidatedAt?.toISOString() ?? null,
    receiverValidatedAtIso: movement.receiverValidatedAt?.toISOString() ?? null,
    postedAtIso: movement.postedAt?.toISOString() ?? null,
    lines: movement.lines.map((line) => ({
      id: line.id,
      productLabel: line.product.productName,
      voucherQty: line.voucherQty.toString(),
      actualQty: line.actualQty?.toString() ?? null,
      postedQty: line.postedQty?.toString() ?? null,
    })),
  };
}

function loadBpoPrintMovement(prisma: ReturnType<typeof getPrismaClient>, id: string) {
  return prisma.stockMovement.findUnique({
    where: { id },
    include: {
      sourceSalesPoint: { select: { name: true } },
      destinationSalesPoint: { select: { name: true } },
      createdBy: { select: { name: true } },
      senderValidatedBy: { select: { name: true } },
      receiverValidatedBy: { select: { name: true } },
      lines: {
        include: {
          product: { select: { productName: true } },
        },
        orderBy: { id: "asc" },
      },
    },
  });
}

export async function createBpoConsignmentVoucher(formData: FormData): Promise<StockMovementMutationResult> {
  const prisma = getPrismaClient();
  let session: Awaited<ReturnType<typeof requireActor>>["session"];
  let actor: Awaited<ReturnType<typeof requireActor>>["actor"];
  try {
    await assertPermissionKey("route:/stock/movements");
    ({ session, actor } = await requireActor(prisma));
    if (!roleMayRaiseBpoConsignmentSenderVoucher(actor.role as AppUserRole)) {
      return {
        ok: false,
        error: "Only sales clerks can create sender consignment vouchers.",
      };
    }
    const botaId = await ensureBotaSalesPointId(prisma);
    const sourceRaw = String(formData.get("sourceSalesPointId") ?? "").trim();
    const sourceSalesPointId = session.salesPoint?.id ?? (sourceRaw ? Number.parseInt(sourceRaw, 10) : null);
    const spErr = salesPointErrorForSubmitted(actor, sourceSalesPointId);
    if (spErr) return { ok: false, error: spErr };
    if (!sourceSalesPointId || !Number.isFinite(sourceSalesPointId)) return { ok: false, error: "Select source sales point." };
    if (sourceSalesPointId === botaId) return { ok: false, error: "Bota does not consign Bottled Palm Oil to itself." };
    const lines = parseLines(String(formData.get("lines") ?? "[]"));
    const productCount = await prisma.product.count({
      where: {
        productId: { in: lines.map((l) => l.productId) },
        form: "BOTTLED",
      },
    });
    if (productCount !== new Set(lines.map((l) => l.productId)).size) {
      return { ok: false, error: "One or more lines are not bottled products." };
    }
    const movementDate = parseDate(String(formData.get("movementDate") ?? ""));
    const availabilityErr = await assertBpoAvailability(prisma, sourceSalesPointId, lines, movementDate);
    if (availabilityErr) return { ok: false, error: availabilityErr };
    const voucherNo = await nextVoucherNo(prisma);
    const movement = await prisma.stockMovement.create({
      data: {
        movementType: StockMovementType.TRANSFER,
        status: StockMovementStatus.DRAFT,
        voucherNo,
        sourceSalesPointId,
        destinationSalesPointId: botaId,
        movementDate,
        note: String(formData.get("note") ?? "").trim() || null,
        createdByUserId: actor.id,
        lines: {
          create: lines.map((l) => ({
            productId: l.productId,
            voucherQty: l.qtyUnits,
          })),
        },
      },
    });
    revalidateStock();
    return { ok: true, id: movement.id, voucherNo: movement.voucherNo };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not create voucher." };
  }
}

export async function senderValidateBpoConsignment(formData: FormData): Promise<StockMovementMutationResult> {
  const prisma = getPrismaClient();
  try {
    await assertPermissionKey("route:/stock/movements");
    const { actor, session } = await requireActor(prisma);
    if (!canValidateBpoDocuments(session.role as UserRole)) {
      return { ok: false, error: "Only authorized supervisors/managers can validate vouchers." };
    }
    const id = String(formData.get("id") ?? "").trim();
    const row = await prisma.stockMovement.findUnique({
      where: { id },
      select: {
        status: true,
        sourceSalesPointId: true,
        movementType: true,
        movementDate: true,
        lines: { select: { productId: true, voucherQty: true } },
      },
    });
    if (!row || row.movementType !== StockMovementType.TRANSFER) return { ok: false, error: "Voucher not found." };
    const accessErr = salesPointErrorForResource(actor, row.sourceSalesPointId);
    if (accessErr) return { ok: false, error: accessErr };
    if (row.status !== StockMovementStatus.DRAFT) return { ok: false, error: "Only draft vouchers can be sender-validated." };
    if (!row.sourceSalesPointId) return { ok: false, error: "Voucher has no source sales point." };
    const availabilityErr = await assertBpoAvailability(
      prisma,
      row.sourceSalesPointId,
      row.lines.map((l) => ({
        productId: l.productId,
        qtyUnits: l.voucherQty,
      })),
      row.movementDate,
      id,
    );
    if (availabilityErr) return { ok: false, error: availabilityErr };
    await prismaRetry(() =>
      prisma.$transaction(
        async (tx) => {
          await postTransferSenderValidation(tx, id);
          await tx.stockMovement.update({
            where: { id },
            data: {
              status: StockMovementStatus.SENDER_VALIDATED,
              senderValidatedByUserId: actor.id,
              senderValidatedAt: new Date(),
            },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    );
    revalidateStock();
    return { ok: true };
  } catch (e) {
    if (e instanceof StockInsufficientError) return { ok: false, error: e.message };
    return { ok: false, error: e instanceof Error ? e.message : "Could not validate voucher." };
  }
}

export async function botaValidateBpoConsignment(formData: FormData): Promise<StockMovementMutationResult> {
  const prisma = getPrismaClient();
  try {
    await assertPermissionKey("route:/stock/movements");
    const { actor, session } = await requireActor(prisma);
    if (!canValidateBotaConsignment(session.role as UserRole)) {
      return { ok: false, error: "Only senior supervisors and managers can validate Bota receipt." };
    }
    const botaId = await ensureBotaSalesPointId(prisma);
    const botaAccessErr = salesPointErrorForResource(actor, botaId);
    if (botaAccessErr) return { ok: false, error: botaAccessErr };
    const id = String(formData.get("id") ?? "").trim();
    const actuals = parseLines(String(formData.get("lines") ?? "[]"));
    const movement = await prisma.stockMovement.findUnique({
      where: { id },
      select: { lines: { select: { id: true, productId: true } } },
    });
    if (!movement) return { ok: false, error: "Voucher not found." };
    const actualByLineId = new Map<string, Prisma.Decimal>();
    for (const line of movement.lines) {
      const actual = actuals.find((a) => a.productId === line.productId);
      if (!actual) return { ok: false, error: "Enter actual quantity for every line." };
      actualByLineId.set(line.id, qty3(actual.actualQty ?? actual.qtyUnits));
    }
    const validated = await prismaRetry(() =>
      prisma.$transaction(
        async (tx) => {
          const m = await tx.stockMovement.findUnique({
            where: { id },
            select: {
              movementType: true,
              status: true,
              sourceSalesPointId: true,
              destinationSalesPointId: true,
            },
          });
          if (!m || m.movementType !== StockMovementType.TRANSFER) {
            throw new Error("Voucher not found.");
          }
          if (m.status !== StockMovementStatus.SENDER_VALIDATED) {
            throw new Error("Bota can only validate sender-validated vouchers.");
          }
          if (!m.sourceSalesPointId || m.destinationSalesPointId !== botaId) {
            throw new Error("Invalid Bota transfer document.");
          }
          await postTransferReceiverValidation(tx, id, actualByLineId);
          return tx.stockMovement.update({
            where: { id },
            data: {
              status: StockMovementStatus.VALIDATED,
              receiverValidatedByUserId: actor.id,
              receiverValidatedAt: new Date(),
              postedAt: new Date(),
              discrepancyNote: String(formData.get("discrepancyNote") ?? "").trim() || null,
            },
            select: { id: true, voucherNo: true },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    );
    revalidateStock();
    return { ok: true, id: validated.id, voucherNo: validated.voucherNo };
  } catch (e) {
    if (e instanceof StockInsufficientError) return { ok: false, error: e.message };
    return { ok: false, error: e instanceof Error ? e.message : "Could not validate Bota receipt." };
  }
}

export async function loadBpoConsignmentVoucherPrint(id: string): Promise<StockTransferPrintResult> {
  const prisma = getPrismaClient();
  try {
    await assertPermissionKey("route:/stock/movements");
    const { actor } = await requireActor(prisma);
    const movement = await loadBpoPrintMovement(prisma, id.trim());
    if (!movement || movement.movementType !== StockMovementType.TRANSFER) {
      return { ok: false, error: "Voucher not found." };
    }
    const accessErr = salesPointErrorForResource(actor, movement.sourceSalesPointId);
    if (accessErr) return { ok: false, error: accessErr };
    return { ok: true, data: mapBpoPrintPayload(movement) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not load voucher print." };
  }
}

export async function loadBpoConsignmentReceiptVoucherPrint(id: string): Promise<StockTransferPrintResult> {
  const prisma = getPrismaClient();
  try {
    await assertPermissionKey("route:/stock/movements");
    const { actor } = await requireActor(prisma);
    const botaId = await ensureBotaSalesPointId(prisma);
    const movement = await loadBpoPrintMovement(prisma, id.trim());
    if (!movement || movement.movementType !== StockMovementType.TRANSFER) {
      return { ok: false, error: "Voucher not found." };
    }
    if (movement.status !== StockMovementStatus.SENDER_VALIDATED || movement.destinationSalesPointId !== botaId) {
      return { ok: false, error: "Receipt voucher is only available for sender-validated Bota transfers." };
    }
    const accessErr = salesPointErrorForResource(actor, botaId);
    if (accessErr) return { ok: false, error: accessErr };
    return { ok: true, data: mapBpoPrintPayload(movement) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not load receipt voucher print." };
  }
}

export async function loadBpoConsignmentConfirmationPrint(id: string): Promise<StockTransferPrintResult> {
  const prisma = getPrismaClient();
  try {
    await assertPermissionKey("route:/stock/movements");
    const { actor } = await requireActor(prisma);
    const botaId = await ensureBotaSalesPointId(prisma);
    const movement = await loadBpoPrintMovement(prisma, id.trim());
    if (!movement || movement.movementType !== StockMovementType.TRANSFER) {
      return { ok: false, error: "Voucher not found." };
    }
    if (movement.status !== StockMovementStatus.VALIDATED || movement.destinationSalesPointId !== botaId) {
      return { ok: false, error: "Confirmation receipt is only available for validated Bota transfers." };
    }
    const accessErr = salesPointErrorForResource(actor, botaId);
    if (accessErr) return { ok: false, error: accessErr };
    return { ok: true, data: mapBpoPrintPayload(movement) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not load confirmation print." };
  }
}

export async function rejectBpoConsignment(formData: FormData): Promise<StockMovementMutationResult> {
  const prisma = getPrismaClient();
  try {
    await assertPermissionKey("route:/stock/movements");
    const { actor, session } = await requireActor(prisma);
    if (!canValidateBpoDocuments(session.role as UserRole)) return { ok: false, error: "Only authorized users can reject vouchers." };
    const id = String(formData.get("id") ?? "").trim();
    const reason = String(formData.get("reason") ?? "").trim();
    const movement = await prisma.stockMovement.findUnique({
      where: { id },
      select: { sourceSalesPointId: true, destinationSalesPointId: true, status: true },
    });
    if (!movement) return { ok: false, error: "Voucher not found." };
    const sourceErr = salesPointErrorForResource(actor, movement.sourceSalesPointId);
    const destErr = salesPointErrorForResource(actor, movement.destinationSalesPointId);
    if (sourceErr && destErr) return { ok: false, error: sourceErr };
    if (movement.status === StockMovementStatus.VALIDATED) {
      return { ok: false, error: "Posted vouchers cannot be rejected." };
    }
    await prismaRetry(() =>
      prisma.$transaction(async (tx) => {
        if (movement.status === StockMovementStatus.SENDER_VALIDATED) {
          await reverseTransferSenderPosting(tx, id);
        }
        await tx.stockMovement.update({
          where: { id },
          data: {
            status: StockMovementStatus.REJECTED,
            rejectedAt: new Date(),
            rejectedReason: reason || null,
          },
        });
      }),
    );
    revalidateStock();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not reject voucher." };
  }
}
