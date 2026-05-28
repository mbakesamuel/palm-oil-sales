"use server";

import {
  assertPermissionKey,
  getPermissionsForSession,
  type PermissionKey,
} from "@/lib/access-control";
import { getServerSession } from "@/lib/auth-server";
import {
  assertFullStockActionAccess,
  assertStockPageActionAccess,
} from "@/lib/stock/stock-page-access-server";
import {
  salesPointErrorForResource,
  salesPointErrorForSubmitted,
} from "@/lib/auth-sales-point-scope";
import { getPrismaClient } from "@/lib/prisma";
import { prismaRetry } from "@/lib/prisma-retry";
import {
  noonUtcFromIsoDate,
  normalizeIsoDateInput,
  utcIsoDateToday,
} from "@/lib/posting-calendar";
import { isInsufficientStockError } from "@/lib/stock/errors";
import { assertTransferLinesAvailableAtSource } from "@/lib/stock/availability";
import { applyMovement, reverseMovementsBySource } from "@/lib/stock/post";
import {
  assertStorageLocationForSalesPoint,
} from "@/lib/stock/storage-location";
import {
  allocateAdjustmentNo,
  allocateReceiptNo,
  allocateTransferNo,
} from "@/lib/stock/sequences";
import {
  Prisma,
  StockCondition,
  StockDocStatus,
  StockMovementKind,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import {
  loadReceiptDetail,
  loadTransferDetail,
  type ReceiptDetail,
  type TransferDetail,
} from "./loaders";

export type StockMutationResult =
  | { ok: true; id: string; documentNo: string }
  | { ok: false; error: string };

export type StockGenericResult = { ok: true } | { ok: false; error: string };

export type ReceiptReviewResult =
  | { ok: true; detail: ReceiptDetail }
  | { ok: false; error: string };

export type TransferReviewResult =
  | { ok: true; detail: TransferDetail }
  | { ok: false; error: string };

type LineInput = {
  productId: string | number;
  qty: string | number;
  storageLocationId: string | number;
};
type TransferLineInput = {
  productId: string | number;
  qty: string | number;
  fromStorageLocationId: string | number;
};
type ReceiveTransferLineInput = {
  lineId: string;
  toStorageLocationId: string | number;
};
type AdjustmentLineInput = {
  productId: string | number;
  deltaQty: string | number;
  storageLocationId: string | number;
  fromCondition?: "SELLABLE" | "UNSELLABLE" | null;
  toCondition?: "SELLABLE" | "UNSELLABLE" | null;
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

async function assertSubPermission(key: PermissionKey) {
  const session = await getServerSession();
  if (!session?.userId) throw new Error("Login required.");
  const perms = await getPermissionsForSession(session);
  if (!perms[key]) {
    throw new Error("You do not have permission to perform this action.");
  }
}

function isReclassifyAdjustmentLine(line: {
  fromCondition: "SELLABLE" | "UNSELLABLE" | null;
  toCondition: "SELLABLE" | "UNSELLABLE" | null;
}): boolean {
  return line.fromCondition != null && line.toCondition != null;
}

async function assertReclassifyPermissionIfNeeded(
  lines: {
    fromCondition: "SELLABLE" | "UNSELLABLE" | null;
    toCondition: "SELLABLE" | "UNSELLABLE" | null;
  }[],
) {
  if (lines.some(isReclassifyAdjustmentLine)) {
    await assertSubPermission("ui:reclassify-stock-condition");
  }
}

function revalidateStockPaths() {
  revalidatePath("/stock");
  revalidatePath("/dashboard");
}

function parseStorageLocationId(raw: unknown, label = "Storage location"): number {
  const id = Number.parseInt(String(raw ?? ""), 10);
  if (!Number.isFinite(id)) throw new Error(`${label} is required on each line.`);
  return id;
}

function parseLines(raw: unknown): { productId: number; qty: Prisma.Decimal; storageLocationId: number }[] {
  const arr = typeof raw === "string" ? (JSON.parse(raw) as unknown) : raw;
  if (!Array.isArray(arr) || arr.length === 0) {
    throw new Error("Add at least one line.");
  }
  return (arr as LineInput[]).map((l) => {
    const productId = Number.parseInt(String(l.productId ?? ""), 10);
    if (!Number.isFinite(productId)) throw new Error("Each line must reference a product.");
    const qty = new Prisma.Decimal(String(l.qty ?? "0"));
    if (qty.lte(0)) throw new Error("Each line quantity must be greater than zero.");
    const storageLocationId = parseStorageLocationId(l.storageLocationId);
    return { productId, qty, storageLocationId };
  });
}

function parseTransferLines(
  raw: unknown,
): {
  productId: number;
  qty: Prisma.Decimal;
  fromStorageLocationId: number;
}[] {
  const arr = typeof raw === "string" ? (JSON.parse(raw) as unknown) : raw;
  if (!Array.isArray(arr) || arr.length === 0) {
    throw new Error("Add at least one line.");
  }
  return (arr as TransferLineInput[]).map((l) => {
    const productId = Number.parseInt(String(l.productId ?? ""), 10);
    if (!Number.isFinite(productId)) throw new Error("Each line must reference a product.");
    const qty = new Prisma.Decimal(String(l.qty ?? "0"));
    if (qty.lte(0)) throw new Error("Each line quantity must be greater than zero.");
    const fromStorageLocationId = parseStorageLocationId(
      l.fromStorageLocationId,
      "Source storage location",
    );
    return { productId, qty, fromStorageLocationId };
  });
}

function parseReceiveTransferLines(
  raw: unknown,
): { lineId: string; toStorageLocationId: number }[] {
  const arr = typeof raw === "string" ? (JSON.parse(raw) as unknown) : raw;
  if (!Array.isArray(arr) || arr.length === 0) {
    throw new Error("Assign a receive location for each line.");
  }
  return (arr as ReceiveTransferLineInput[]).map((l) => {
    const lineId = String(l.lineId ?? "").trim();
    if (!lineId) throw new Error("Each line must be identified.");
    const toStorageLocationId = parseStorageLocationId(
      l.toStorageLocationId,
      "Receive into location",
    );
    return { lineId, toStorageLocationId };
  });
}

function parseAdjustmentLines(
  raw: unknown,
): {
  productId: number;
  deltaQty: Prisma.Decimal;
  storageLocationId: number;
  fromCondition: "SELLABLE" | "UNSELLABLE" | null;
  toCondition: "SELLABLE" | "UNSELLABLE" | null;
}[] {
  const arr = typeof raw === "string" ? (JSON.parse(raw) as unknown) : raw;
  if (!Array.isArray(arr) || arr.length === 0) {
    throw new Error("Add at least one adjustment line.");
  }
  return (arr as AdjustmentLineInput[]).map((l) => {
    const productId = Number.parseInt(String(l.productId ?? ""), 10);
    if (!Number.isFinite(productId)) throw new Error("Each line must reference a product.");
    const delta = new Prisma.Decimal(String(l.deltaQty ?? "0"));
    if (delta.eq(0)) throw new Error("Each adjustment line must be non-zero.");
    const storageLocationId = parseStorageLocationId(l.storageLocationId);
    const fromCondition =
      l.fromCondition === "SELLABLE" || l.fromCondition === "UNSELLABLE"
        ? l.fromCondition
        : null;
    const toCondition =
      l.toCondition === "SELLABLE" || l.toCondition === "UNSELLABLE" ? l.toCondition : null;

    if ((fromCondition && !toCondition) || (!fromCondition && toCondition)) {
      throw new Error("Reclassification lines must specify both fromCondition and toCondition.");
    }
    if (fromCondition && toCondition && fromCondition === toCondition) {
      throw new Error("Reclassification must change between sellable and unsellable.");
    }
    if (fromCondition && toCondition && delta.lte(0)) {
      throw new Error("Reclassification quantity must be greater than zero.");
    }

    return { productId, deltaQty: delta, storageLocationId, fromCondition, toCondition };
  });
}

function parseSalesPointId(formData: FormData, key = "salesPointId"): number | null {
  const raw = String(formData.get(key) ?? "").trim();
  if (!raw) return null;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : null;
}

function parseDateField(formData: FormData, key: string): Date {
  const raw = String(formData.get(key) ?? "").trim();
  const iso = normalizeIsoDateInput(raw) ?? utcIsoDateToday();
  return noonUtcFromIsoDate(iso);
}

function describePostingError(e: unknown, fallback: string): string {
  if (isInsufficientStockError(e)) return e.message;
  return e instanceof Error ? e.message : fallback;
}

// ============================================================================
// RECEIPT
// ============================================================================

export async function saveReceipt(formData: FormData): Promise<StockMutationResult> {
  const prisma = getPrismaClient();

  let session: Awaited<ReturnType<typeof requireActor>>["session"];
  let actor: Awaited<ReturnType<typeof requireActor>>["actor"];
  try {
    await assertFullStockActionAccess();
    ({ session, actor } = await requireActor(prisma));
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Login required." };
  }

  const id = String(formData.get("id") ?? "").trim() || null;
  const salesPointId = parseSalesPointId(formData);
  const supplierLabel = String(formData.get("supplierLabel") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const receivedAt = parseDateField(formData, "receivedAt");

  if (!supplierLabel) return { ok: false, error: "Supplier label is required." };
  if (salesPointId == null) return { ok: false, error: "Sales point is required." };

  const submittedErr = salesPointErrorForSubmitted(actor, salesPointId);
  if (submittedErr) return { ok: false, error: submittedErr };

  let lines: ReturnType<typeof parseLines>;
  try {
    lines = parseLines(formData.get("lines"));
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Invalid lines." };
  }

  try {
    const result = await prismaRetry(() =>
      prisma.$transaction(async (tx) => {
        for (const line of lines) {
          await assertStorageLocationForSalesPoint(tx, salesPointId, line.storageLocationId);
        }

        if (id) {
          const existing = await tx.stockReceipt.findUnique({
            where: { id },
            select: { id: true, status: true, salesPointId: true },
          });
          if (!existing) throw new Error("Receipt not found.");
          const accessErr = salesPointErrorForResource(actor, existing.salesPointId);
          if (accessErr) throw new Error(accessErr);
          if (existing.status !== StockDocStatus.DRAFT) {
            throw new Error("Only draft receipts can be edited.");
          }
          await tx.stockReceiptLine.deleteMany({ where: { receiptId: id } });
          const updated = await tx.stockReceipt.update({
            where: { id },
            data: {
              salesPointId,
              receivedAt,
              supplierLabel,
              notes,
              lines: {
                create: lines.map((l) => ({
                  productId: l.productId,
                  qty: l.qty,
                  storageLocationId: l.storageLocationId,
                })),
              },
            },
            select: { id: true, receiptNo: true },
          });
          return updated;
        }

        const receiptNo = await allocateReceiptNo(tx, receivedAt);
        const created = await tx.stockReceipt.create({
          data: {
            receiptNo,
            salesPointId,
            receivedAt,
            supplierLabel,
            notes,
            status: StockDocStatus.DRAFT,
            createdByUserId: session.userId,
            lines: {
              create: lines.map((l) => ({
                productId: l.productId,
                qty: l.qty,
                storageLocationId: l.storageLocationId,
              })),
            },
          },
          select: { id: true, receiptNo: true },
        });
        return created;
      }),
    );

    revalidateStockPaths();
    return { ok: true, id: result.id, documentNo: result.receiptNo };
  } catch (e) {
    return { ok: false, error: describePostingError(e, "Could not save receipt.") };
  }
}

export async function postReceipt(receiptId: string): Promise<StockGenericResult> {
  const prisma = getPrismaClient();
  const id = String(receiptId ?? "").trim();
  if (!id) return { ok: false, error: "Invalid receipt." };

  let session: Awaited<ReturnType<typeof requireActor>>["session"];
  let actor: Awaited<ReturnType<typeof requireActor>>["actor"];
  try {
    await assertFullStockActionAccess();
    await assertSubPermission("ui:post-stock-receipt");
    ({ session, actor } = await requireActor(prisma));
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Login required." };
  }

  try {
    await prismaRetry(() =>
      prisma.$transaction(async (tx) => {
        const existing = await tx.stockReceipt.findUnique({
          where: { id },
          include: { lines: true },
        });
        if (!existing) throw new Error("Receipt not found.");
        const accessErr = salesPointErrorForResource(actor, existing.salesPointId);
        if (accessErr) throw new Error(accessErr);
        if (existing.status === StockDocStatus.POSTED) return;
        if (existing.status !== StockDocStatus.DRAFT) {
          throw new Error(`Cannot post a receipt in status ${existing.status}.`);
        }
        if (existing.lines.length === 0) {
          throw new Error("Add at least one line before posting.");
        }

        for (const line of existing.lines) {
          await applyMovement(tx, {
            salesPointId: existing.salesPointId,
            productId: line.productId,
            storageLocationId: line.storageLocationId,
            qty: line.qty,
            kind: StockMovementKind.RECEIPT,
            occurredAt: existing.receivedAt,
            userId: session.userId,
            sourceKind: "RECEIPT",
            sourceId: existing.id,
          });
        }

        await tx.stockReceipt.update({
          where: { id },
          data: {
            status: StockDocStatus.POSTED,
            postedByUserId: session.userId,
            postedAt: new Date(),
          },
        });
      }),
    );

    revalidateStockPaths();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: describePostingError(e, "Could not post receipt.") };
  }
}

export async function cancelReceipt(receiptId: string): Promise<StockGenericResult> {
  return cancelStockDocument("RECEIPT", receiptId);
}

// ============================================================================
// TRANSFER
// ============================================================================

export async function saveTransfer(formData: FormData): Promise<StockMutationResult> {
  const prisma = getPrismaClient();

  let session: Awaited<ReturnType<typeof requireActor>>["session"];
  let actor: Awaited<ReturnType<typeof requireActor>>["actor"];
  try {
    await assertFullStockActionAccess();
    ({ session, actor } = await requireActor(prisma));
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Login required." };
  }

  const id = String(formData.get("id") ?? "").trim() || null;
  const fromSalesPointId = parseSalesPointId(formData, "fromSalesPointId");
  const toSalesPointId = parseSalesPointId(formData, "toSalesPointId");
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const issuedAt = parseDateField(formData, "dispatchedAt");

  if (fromSalesPointId == null) return { ok: false, error: "Source sales point is required." };
  if (toSalesPointId == null) return { ok: false, error: "Destination sales point is required." };
  if (fromSalesPointId === toSalesPointId) {
    return { ok: false, error: "Source and destination must differ." };
  }

  const sourceErr = salesPointErrorForSubmitted(actor, fromSalesPointId);
  if (sourceErr) return { ok: false, error: sourceErr };

  let lines: ReturnType<typeof parseTransferLines>;
  try {
    lines = parseTransferLines(formData.get("lines"));
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Invalid lines." };
  }

  try {
    const result = await prismaRetry(() =>
      prisma.$transaction(async (tx) => {
        for (const line of lines) {
          await assertStorageLocationForSalesPoint(
            tx,
            fromSalesPointId,
            line.fromStorageLocationId,
          );
        }

        await assertTransferLinesAvailableAtSource(tx, fromSalesPointId, lines);

        if (id) {
          const existing = await tx.stockTransfer.findUnique({
            where: { id },
            select: { id: true, status: true, fromSalesPointId: true },
          });
          if (!existing) throw new Error("Transfer not found.");
          const accessErr = salesPointErrorForResource(actor, existing.fromSalesPointId);
          if (accessErr) throw new Error(accessErr);
          if (existing.status !== StockDocStatus.DRAFT) {
            throw new Error("Only draft transfers can be edited.");
          }
          await tx.stockTransferLine.deleteMany({ where: { transferId: id } });
          const updated = await tx.stockTransfer.update({
            where: { id },
            data: {
              fromSalesPointId,
              toSalesPointId,
              dispatchedAt: issuedAt,
              notes,
              lines: {
                create: lines.map((l) => ({
                  productId: l.productId,
                  qty: l.qty,
                  fromStorageLocationId: l.fromStorageLocationId,
                })),
              },
            },
            select: { id: true, transferNo: true },
          });
          return updated;
        }

        const transferNo = await allocateTransferNo(tx, issuedAt);
        const created = await tx.stockTransfer.create({
          data: {
            transferNo,
            fromSalesPointId,
            toSalesPointId,
            dispatchedAt: issuedAt,
            notes,
            status: StockDocStatus.DRAFT,
            createdByUserId: session.userId,
            lines: {
              create: lines.map((l) => ({
                productId: l.productId,
                qty: l.qty,
                fromStorageLocationId: l.fromStorageLocationId,
              })),
            },
          },
          select: { id: true, transferNo: true },
        });
        return created;
      }),
    );

    revalidateStockPaths();
    return { ok: true, id: result.id, documentNo: result.transferNo };
  } catch (e) {
    return { ok: false, error: describePostingError(e, "Could not save transfer.") };
  }
}

export async function dispatchTransfer(transferId: string): Promise<StockGenericResult> {
  const prisma = getPrismaClient();
  const id = String(transferId ?? "").trim();
  if (!id) return { ok: false, error: "Invalid transfer." };

  let session: Awaited<ReturnType<typeof requireActor>>["session"];
  let actor: Awaited<ReturnType<typeof requireActor>>["actor"];
  try {
    await assertFullStockActionAccess();
    await assertSubPermission("ui:dispatch-stock-transfer");
    ({ session, actor } = await requireActor(prisma));
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Login required." };
  }

  try {
    await prismaRetry(() =>
      prisma.$transaction(async (tx) => {
        const existing = await tx.stockTransfer.findUnique({
          where: { id },
          include: { lines: true },
        });
        if (!existing) throw new Error("Transfer not found.");
        const accessErr = salesPointErrorForResource(actor, existing.fromSalesPointId);
        if (accessErr) throw new Error(accessErr);
        if (existing.status === StockDocStatus.DISPATCHED || existing.status === StockDocStatus.RECEIVED) {
          return;
        }
        if (existing.status !== StockDocStatus.DRAFT) {
          throw new Error(`Cannot dispatch a transfer in status ${existing.status}.`);
        }
        if (existing.lines.length === 0) {
          throw new Error("Add at least one line before dispatching.");
        }

        const dispatchedAt = existing.dispatchedAt ?? new Date();
        for (const line of existing.lines) {
          await applyMovement(tx, {
            salesPointId: existing.fromSalesPointId,
            productId: line.productId,
            storageLocationId: line.fromStorageLocationId,
            qty: line.qty,
            kind: StockMovementKind.TRANSFER_OUT,
            occurredAt: dispatchedAt,
            userId: session.userId,
            sourceKind: "TRANSFER",
            sourceId: existing.id,
          });
        }

        await tx.stockTransfer.update({
          where: { id },
          data: {
            status: StockDocStatus.DISPATCHED,
            dispatchedAt,
            dispatchedByUserId: session.userId,
          },
        });
      }),
    );

    revalidateStockPaths();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: describePostingError(e, "Could not dispatch transfer.") };
  }
}

export async function receiveTransfer(formData: FormData): Promise<StockGenericResult> {
  const prisma = getPrismaClient();
  const id = String(formData.get("transferId") ?? "").trim();
  if (!id) return { ok: false, error: "Invalid transfer." };

  let session: Awaited<ReturnType<typeof requireActor>>["session"];
  let actor: Awaited<ReturnType<typeof requireActor>>["actor"];
  try {
    await assertFullStockActionAccess();
    await assertSubPermission("ui:receive-stock-transfer");
    ({ session, actor } = await requireActor(prisma));
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Login required." };
  }

  let receiveLines: ReturnType<typeof parseReceiveTransferLines>;
  try {
    receiveLines = parseReceiveTransferLines(formData.get("lines"));
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Invalid receive lines." };
  }

  try {
    await prismaRetry(() =>
      prisma.$transaction(async (tx) => {
        const existing = await tx.stockTransfer.findUnique({
          where: { id },
          include: { lines: true },
        });
        if (!existing) throw new Error("Transfer not found.");
        const destErr = salesPointErrorForResource(actor, existing.toSalesPointId);
        if (destErr) throw new Error(destErr);
        if (existing.status === StockDocStatus.RECEIVED) return;
        if (existing.status !== StockDocStatus.DISPATCHED) {
          throw new Error("Only dispatched transfers can be received.");
        }

        if (receiveLines.length !== existing.lines.length) {
          throw new Error("Assign a receive location for every line.");
        }

        const lineById = new Map(existing.lines.map((l) => [l.id, l]));
        for (const rl of receiveLines) {
          if (!lineById.has(rl.lineId)) {
            throw new Error("One or more lines do not belong to this transfer.");
          }
          await assertStorageLocationForSalesPoint(
            tx,
            existing.toSalesPointId,
            rl.toStorageLocationId,
          );
        }

        const receivedAt = new Date();
        for (const rl of receiveLines) {
          const line = lineById.get(rl.lineId)!;
          await tx.stockTransferLine.update({
            where: { id: line.id },
            data: { toStorageLocationId: rl.toStorageLocationId },
          });
          await applyMovement(tx, {
            salesPointId: existing.toSalesPointId,
            productId: line.productId,
            storageLocationId: rl.toStorageLocationId,
            qty: line.qty,
            kind: StockMovementKind.TRANSFER_IN,
            occurredAt: receivedAt,
            userId: session.userId,
            sourceKind: "TRANSFER",
            sourceId: existing.id,
          });
        }

        await tx.stockTransfer.update({
          where: { id },
          data: {
            status: StockDocStatus.RECEIVED,
            receivedAt,
            receivedByUserId: session.userId,
          },
        });
      }),
    );

    revalidateStockPaths();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: describePostingError(e, "Could not receive transfer.") };
  }
}

export async function cancelTransfer(transferId: string): Promise<StockGenericResult> {
  return cancelStockDocument("TRANSFER", transferId);
}

// ============================================================================
// ADJUSTMENT
// ============================================================================

export async function saveAdjustment(formData: FormData): Promise<StockMutationResult> {
  const prisma = getPrismaClient();

  let session: Awaited<ReturnType<typeof requireActor>>["session"];
  let actor: Awaited<ReturnType<typeof requireActor>>["actor"];
  try {
    await assertStockPageActionAccess();
    ({ session, actor } = await requireActor(prisma));
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Login required." };
  }

  const id = String(formData.get("id") ?? "").trim() || null;
  const salesPointId = parseSalesPointId(formData);
  const reason = String(formData.get("reason") ?? "").trim();
  const occurredAt = parseDateField(formData, "occurredAt");

  if (salesPointId == null) return { ok: false, error: "Sales point is required." };
  if (!reason) return { ok: false, error: "Reason is required." };

  const submittedErr = salesPointErrorForSubmitted(actor, salesPointId);
  if (submittedErr) return { ok: false, error: submittedErr };

  let lines: ReturnType<typeof parseAdjustmentLines>;
  try {
    lines = parseAdjustmentLines(formData.get("lines"));
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Invalid lines." };
  }

  try {
    await assertReclassifyPermissionIfNeeded(lines);
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "You do not have permission to reclassify stock.",
    };
  }

  try {
    const result = await prismaRetry(() =>
      prisma.$transaction(async (tx) => {
        for (const line of lines) {
          await assertStorageLocationForSalesPoint(tx, salesPointId, line.storageLocationId);
        }

        if (id) {
          const existing = await tx.stockAdjustment.findUnique({
            where: { id },
            select: { id: true, status: true, salesPointId: true },
          });
          if (!existing) throw new Error("Adjustment not found.");
          const accessErr = salesPointErrorForResource(actor, existing.salesPointId);
          if (accessErr) throw new Error(accessErr);
          if (existing.status !== StockDocStatus.DRAFT) {
            throw new Error("Only draft adjustments can be edited.");
          }
          await tx.stockAdjustmentLine.deleteMany({ where: { adjustmentId: id } });
          const updated = await tx.stockAdjustment.update({
            where: { id },
            data: {
              salesPointId,
              occurredAt,
              reason,
              lines: {
                create: lines.map((l) => ({
                  productId: l.productId,
                  deltaQty: l.deltaQty,
                  storageLocationId: l.storageLocationId,
                  fromCondition: l.fromCondition,
                  toCondition: l.toCondition,
                })),
              },
            },
            select: { id: true, adjustmentNo: true },
          });
          return updated;
        }

        const adjustmentNo = await allocateAdjustmentNo(tx, occurredAt);
        const created = await tx.stockAdjustment.create({
          data: {
            adjustmentNo,
            salesPointId,
            occurredAt,
            reason,
            status: StockDocStatus.DRAFT,
            createdByUserId: session.userId,
            lines: {
              create: lines.map((l) => ({
                productId: l.productId,
                deltaQty: l.deltaQty,
                storageLocationId: l.storageLocationId,
                fromCondition: l.fromCondition,
                toCondition: l.toCondition,
              })),
            },
          },
          select: { id: true, adjustmentNo: true },
        });
        return created;
      }),
    );

    revalidateStockPaths();
    return { ok: true, id: result.id, documentNo: result.adjustmentNo };
  } catch (e) {
    return { ok: false, error: describePostingError(e, "Could not save adjustment.") };
  }
}

export async function postAdjustment(adjustmentId: string): Promise<StockGenericResult> {
  const prisma = getPrismaClient();
  const id = String(adjustmentId ?? "").trim();
  if (!id) return { ok: false, error: "Invalid adjustment." };

  let session: Awaited<ReturnType<typeof requireActor>>["session"];
  let actor: Awaited<ReturnType<typeof requireActor>>["actor"];
  try {
    await assertStockPageActionAccess();
    await assertSubPermission("ui:post-stock-adjustment");
    ({ session, actor } = await requireActor(prisma));
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Login required." };
  }

  try {
    const reclassifyPreview = await prisma.stockAdjustment.findUnique({
      where: { id },
      select: {
        lines: { select: { fromCondition: true, toCondition: true } },
      },
    });
    if (reclassifyPreview?.lines.some(isReclassifyAdjustmentLine)) {
      await assertSubPermission("ui:reclassify-stock-condition");
    }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "You do not have permission to reclassify stock.",
    };
  }

  try {
    await prismaRetry(() =>
      prisma.$transaction(async (tx) => {
        const existing = await tx.stockAdjustment.findUnique({
          where: { id },
          include: { lines: true },
        });
        if (!existing) throw new Error("Adjustment not found.");
        const accessErr = salesPointErrorForResource(actor, existing.salesPointId);
        if (accessErr) throw new Error(accessErr);
        if (existing.status === StockDocStatus.POSTED) return;
        if (existing.status !== StockDocStatus.DRAFT) {
          throw new Error(`Cannot post an adjustment in status ${existing.status}.`);
        }
        if (existing.lines.length === 0) {
          throw new Error("Add at least one line before posting.");
        }

        for (const line of existing.lines) {
          if (line.fromCondition && line.toCondition) {
            // Reclassify between conditions at the same location: -qty from source condition, +qty to target condition.
            const qty = new Prisma.Decimal(line.deltaQty);
            if (qty.lte(0)) throw new Error("Reclassification quantity must be greater than zero.");
            await applyMovement(tx, {
              salesPointId: existing.salesPointId,
              productId: line.productId,
              storageLocationId: line.storageLocationId,
              condition: line.fromCondition as StockCondition,
              qty: qty.neg(),
              kind: StockMovementKind.ADJUSTMENT,
              occurredAt: existing.occurredAt,
              userId: session.userId,
              sourceKind: "ADJUSTMENT",
              sourceId: existing.id,
              notes: `Reclassify ${line.fromCondition} -> ${line.toCondition}`,
            });
            await applyMovement(tx, {
              salesPointId: existing.salesPointId,
              productId: line.productId,
              storageLocationId: line.storageLocationId,
              condition: line.toCondition as StockCondition,
              qty,
              kind: StockMovementKind.ADJUSTMENT,
              occurredAt: existing.occurredAt,
              userId: session.userId,
              sourceKind: "ADJUSTMENT",
              sourceId: existing.id,
              notes: `Reclassify ${line.fromCondition} -> ${line.toCondition}`,
            });
          } else {
            await applyMovement(tx, {
              salesPointId: existing.salesPointId,
              productId: line.productId,
              storageLocationId: line.storageLocationId,
              qty: line.deltaQty,
              kind: StockMovementKind.ADJUSTMENT,
              occurredAt: existing.occurredAt,
              userId: session.userId,
              sourceKind: "ADJUSTMENT",
              sourceId: existing.id,
            });
          }
        }

        await tx.stockAdjustment.update({
          where: { id },
          data: {
            status: StockDocStatus.POSTED,
            postedByUserId: session.userId,
            postedAt: new Date(),
          },
        });
      }),
    );

    revalidateStockPaths();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: describePostingError(e, "Could not post adjustment.") };
  }
}

export async function cancelAdjustment(adjustmentId: string): Promise<StockGenericResult> {
  return cancelStockDocument("ADJUSTMENT", adjustmentId);
}

// ============================================================================
// CANCEL / DELETE
// ============================================================================

async function cancelStockDocument(
  kind: "RECEIPT" | "TRANSFER" | "ADJUSTMENT",
  documentId: string,
): Promise<StockGenericResult> {
  const prisma = getPrismaClient();
  const id = String(documentId ?? "").trim();
  if (!id) return { ok: false, error: "Invalid document." };

  let session: Awaited<ReturnType<typeof requireActor>>["session"];
  let actor: Awaited<ReturnType<typeof requireActor>>["actor"];
  try {
    await assertFullStockActionAccess();
    ({ session, actor } = await requireActor(prisma));
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Login required." };
  }

  try {
    await prismaRetry(() =>
      prisma.$transaction(async (tx) => {
        if (kind === "RECEIPT") {
          const existing = await tx.stockReceipt.findUnique({
            where: { id },
            select: { id: true, status: true, salesPointId: true },
          });
          if (!existing) throw new Error("Receipt not found.");
          const accessErr = salesPointErrorForResource(actor, existing.salesPointId);
          if (accessErr) throw new Error(accessErr);

          if (existing.status === StockDocStatus.DRAFT) {
            await tx.stockReceipt.delete({ where: { id } });
            return;
          }

          if (existing.status === StockDocStatus.CANCELLED) return;

          await assertSubPermission("ui:cancel-stock-document");
          await reverseMovementsBySource(tx, {
            sourceKind: "RECEIPT",
            sourceId: id,
            userId: session.userId,
            occurredAt: new Date(),
            notes: `Cancellation of receipt ${id}`,
          });
          await tx.stockReceipt.update({
            where: { id },
            data: { status: StockDocStatus.CANCELLED },
          });
          return;
        }

        if (kind === "TRANSFER") {
          const existing = await tx.stockTransfer.findUnique({
            where: { id },
            select: {
              id: true,
              status: true,
              fromSalesPointId: true,
              toSalesPointId: true,
            },
          });
          if (!existing) throw new Error("Transfer not found.");
          const sourceErr = salesPointErrorForResource(actor, existing.fromSalesPointId);
          if (sourceErr) throw new Error(sourceErr);

          if (existing.status === StockDocStatus.DRAFT) {
            await tx.stockTransfer.delete({ where: { id } });
            return;
          }
          if (existing.status === StockDocStatus.CANCELLED) return;

          await assertSubPermission("ui:cancel-stock-document");
          await reverseMovementsBySource(tx, {
            sourceKind: "TRANSFER",
            sourceId: id,
            userId: session.userId,
            occurredAt: new Date(),
            notes: `Cancellation of transfer ${id}`,
          });
          await tx.stockTransfer.update({
            where: { id },
            data: { status: StockDocStatus.CANCELLED },
          });
          return;
        }

        // ADJUSTMENT
        const existing = await tx.stockAdjustment.findUnique({
          where: { id },
          select: { id: true, status: true, salesPointId: true },
        });
        if (!existing) throw new Error("Adjustment not found.");
        const accessErr = salesPointErrorForResource(actor, existing.salesPointId);
        if (accessErr) throw new Error(accessErr);

        if (existing.status === StockDocStatus.DRAFT) {
          await tx.stockAdjustment.delete({ where: { id } });
          return;
        }
        if (existing.status === StockDocStatus.CANCELLED) return;

        await assertSubPermission("ui:cancel-stock-document");
        await reverseMovementsBySource(tx, {
          sourceKind: "ADJUSTMENT",
          sourceId: id,
          userId: session.userId,
          occurredAt: new Date(),
          notes: `Cancellation of adjustment ${id}`,
        });
        await tx.stockAdjustment.update({
          where: { id },
          data: { status: StockDocStatus.CANCELLED },
        });
      }),
    );

    revalidateStockPaths();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: describePostingError(e, "Could not cancel document.") };
  }
}

// ============================================================================
// LOOKUP / REVIEW
// ============================================================================
//
// Used by supervisors to "call" a draft voucher by its document number off a
// printout supplied by the clerk, cross-check the line items, and then post or
// dispatch from the review dialog.

function normaliseDocNo(raw: string): string {
  return String(raw ?? "").trim().toUpperCase();
}

export async function findReceiptByNumber(receiptNo: string): Promise<ReceiptReviewResult> {
  const prisma = getPrismaClient();
  try {
    await assertFullStockActionAccess();
    const trimmed = normaliseDocNo(receiptNo);
    if (!trimmed) return { ok: false, error: "Enter a receipt number." };
    const row = await prisma.stockReceipt.findUnique({
      where: { receiptNo: trimmed },
      select: { id: true },
    });
    if (!row) return { ok: false, error: `Receipt "${trimmed}" not found.` };
    const detail = await loadReceiptDetail(row.id);
    if (!detail) {
      return {
        ok: false,
        error: `Receipt "${trimmed}" is not visible to your sales point.`,
      };
    }
    return { ok: true, detail };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not load receipt.",
    };
  }
}

export async function findTransferByNumber(transferNo: string): Promise<TransferReviewResult> {
  const prisma = getPrismaClient();
  try {
    await assertFullStockActionAccess();
    const trimmed = normaliseDocNo(transferNo);
    if (!trimmed) return { ok: false, error: "Enter a transfer number." };
    const row = await prisma.stockTransfer.findUnique({
      where: { transferNo: trimmed },
      select: { id: true },
    });
    if (!row) return { ok: false, error: `Transfer "${trimmed}" not found.` };
    const detail = await loadTransferDetail(row.id);
    if (!detail) {
      return {
        ok: false,
        error: `Transfer "${trimmed}" is not visible to your sales point.`,
      };
    }
    return { ok: true, detail };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not load transfer.",
    };
  }
}

export async function loadReceiptForReview(receiptId: string): Promise<ReceiptReviewResult> {
  try {
    await assertFullStockActionAccess();
    const id = String(receiptId ?? "").trim();
    if (!id) return { ok: false, error: "Invalid receipt." };
    const detail = await loadReceiptDetail(id);
    if (!detail) return { ok: false, error: "Receipt not found." };
    return { ok: true, detail };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not load receipt.",
    };
  }
}

export async function loadTransferForReview(transferId: string): Promise<TransferReviewResult> {
  try {
    await assertFullStockActionAccess();
    const id = String(transferId ?? "").trim();
    if (!id) return { ok: false, error: "Invalid transfer." };
    const detail = await loadTransferDetail(id);
    if (!detail) return { ok: false, error: "Transfer not found." };
    return { ok: true, detail };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not load transfer.",
    };
  }
}
