import "server-only";

import {
  Prisma,
  StockDocStatus,
  StockMovementKind,
} from "@prisma/client";
import type { AuthSession } from "@/lib/auth-session";
import {
  assertPermissionKeyForSession,
  getPermissionsForSession,
} from "@/lib/access-control";
import {
  actorFromAuthSession,
  salesPointErrorForResource,
} from "@/lib/auth-sales-point-scope";
import { scopedSalesPointIdFromSession } from "@/lib/sales-point-assignment";
import { getPrismaClient } from "@/lib/prisma";
import { prismaRetry } from "@/lib/prisma-retry";
import { prismaDateToIso } from "@/lib/posting-calendar";
import { assertStockAccessForSession } from "@/lib/stock/assert-stock-for-session";
import { applyMovement } from "@/lib/stock/post";
import {
  assertStorageLocationForSalesPoint,
  resolveDefaultStorageLocationId,
} from "@/lib/stock/storage-location";

export type MobileReceiptListRow = {
  id: string;
  receiptNo: string;
  salesPointName: string;
  supplierLabel: string;
  status: string;
  totalQty: string;
  lineCount: number;
  createdByName: string;
  receivedAtIso: string;
};

export type MobileTransferListRow = {
  id: string;
  transferNo: string;
  fromSalesPointName: string;
  toSalesPointName: string;
  status: string;
  totalQty: string;
  lineCount: number;
  createdByName: string;
  dispatchedAtIso: string | null;
};

export type MobileReceiptDetail = {
  id: string;
  receiptNo: string;
  salesPointName: string;
  supplierLabel: string;
  status: string;
  receivedAtIso: string;
  createdByName: string;
  createdAtIso: string;
  postedByName: string | null;
  postedAtIso: string | null;
  notes: string | null;
  totalQty: string;
  lines: Array<{
    productName: string;
    qty: string;
    uom: string;
    storageLocationName: string;
  }>;
};

export type MobileTransferDetail = {
  id: string;
  transferNo: string;
  fromSalesPointName: string;
  toSalesPointName: string;
  status: string;
  dispatchedAtIso: string | null;
  receivedAtIso: string | null;
  createdByName: string;
  createdAtIso: string;
  dispatchedByName: string | null;
  receivedByName: string | null;
  notes: string | null;
  totalQty: string;
  lines: Array<{
    id: string;
    productName: string;
    qty: string;
    uom: string;
    fromStorageLocationName: string;
    toStorageLocationName: string | null;
  }>;
  receiveLocations: Array<{ id: number; name: string; isSellable: boolean }>;
};

function uomForBottled(isBottled: boolean): string {
  return isBottled ? "Unit" : "Kg";
}

function scopedSalesPointIdForSession(session: AuthSession): number | null {
  return scopedSalesPointIdFromSession(session);
}

export async function listDraftReceiptsForSession(
  session: AuthSession,
): Promise<MobileReceiptListRow[]> {
  await assertStockAccessForSession(session);
  await assertPermissionKeyForSession(session, "ui:post-stock-receipt");

  const prisma = getPrismaClient();
  const scopedSalesPointId = await scopedSalesPointIdForSession(session);

  const rows = await prisma.stockReceipt.findMany({
    where: {
      status: StockDocStatus.DRAFT,
      ...(scopedSalesPointId != null
        ? { salesPointId: scopedSalesPointId }
        : {}),
    },
    include: {
      salesPoint: { select: { name: true } },
      createdBy: { select: { name: true } },
      lines: { select: { qty: true } },
    },
    orderBy: [{ receivedAt: "desc" }, { createdAt: "desc" }],
    take: 50,
  });

  return rows.map((r) => {
    const total = r.lines.reduce(
      (acc, line) => acc.add(line.qty),
      new Prisma.Decimal(0),
    );
    return {
      id: r.id,
      receiptNo: r.receiptNo,
      salesPointName: r.salesPoint.name,
      supplierLabel: r.supplierLabel,
      status: r.status,
      totalQty: total.toString(),
      lineCount: r.lines.length,
      createdByName: r.createdBy.name,
      receivedAtIso: prismaDateToIso(r.receivedAt),
    };
  });
}

export async function listTransfersForSession(
  session: AuthSession,
  mode: "dispatch" | "receive",
): Promise<MobileTransferListRow[]> {
  await assertStockAccessForSession(session);
  const perms = await getPermissionsForSession(session);
  if (mode === "dispatch") {
    if (!perms["ui:dispatch-stock-transfer"]) return [];
    await assertPermissionKeyForSession(session, "ui:dispatch-stock-transfer");
  } else {
    if (!perms["ui:receive-stock-transfer"]) return [];
    await assertPermissionKeyForSession(session, "ui:receive-stock-transfer");
  }

  const prisma = getPrismaClient();
  const scopedSalesPointId = await scopedSalesPointIdForSession(session);

  const status =
    mode === "dispatch" ? StockDocStatus.DRAFT : StockDocStatus.DISPATCHED;

  const where: Prisma.StockTransferWhereInput = { status };
  if (scopedSalesPointId != null) {
    if (mode === "dispatch") {
      where.fromSalesPointId = scopedSalesPointId;
    } else {
      where.toSalesPointId = scopedSalesPointId;
    }
  }

  const rows = await prisma.stockTransfer.findMany({
    where,
    include: {
      fromSalesPoint: { select: { name: true } },
      toSalesPoint: { select: { name: true } },
      createdBy: { select: { name: true } },
      lines: { select: { qty: true } },
    },
    orderBy: [{ createdAt: "desc" }],
    take: 50,
  });

  return rows.map((r) => {
    const total = r.lines.reduce(
      (acc, line) => acc.add(line.qty),
      new Prisma.Decimal(0),
    );
    return {
      id: r.id,
      transferNo: r.transferNo,
      fromSalesPointName: r.fromSalesPoint.name,
      toSalesPointName: r.toSalesPoint.name,
      status: r.status,
      totalQty: total.toString(),
      lineCount: r.lines.length,
      createdByName: r.createdBy.name,
      dispatchedAtIso: r.dispatchedAt ? prismaDateToIso(r.dispatchedAt) : null,
    };
  });
}

export async function getReceiptDetailForSession(
  session: AuthSession,
  receiptId: string,
): Promise<MobileReceiptDetail | null> {
  await assertStockAccessForSession(session);
  const prisma = getPrismaClient();
  const scopedSalesPointId = await scopedSalesPointIdForSession(session);
  const id = String(receiptId ?? "").trim();
  if (!id) return null;

  const row = await prisma.stockReceipt.findUnique({
    where: { id },
    include: {
      salesPoint: { select: { name: true } },
      createdBy: { select: { name: true } },
      postedBy: { select: { name: true } },
      lines: {
        include: {
          storageLocation: { select: { name: true } },
          product: {
            select: {
              productName: true,
              uom: true,
              productCat: { select: { isBottled: true } },
            },
          },
        },
        orderBy: { id: "asc" },
      },
    },
  });
  if (!row) return null;
  if (scopedSalesPointId != null && row.salesPointId !== scopedSalesPointId) return null;

  const total = row.lines.reduce(
    (acc, line) => acc.add(line.qty),
    new Prisma.Decimal(0),
  );

  return {
    id: row.id,
    receiptNo: row.receiptNo,
    salesPointName: row.salesPoint.name,
    supplierLabel: row.supplierLabel,
    status: row.status,
    receivedAtIso: prismaDateToIso(row.receivedAt),
    createdByName: row.createdBy.name,
    createdAtIso: row.createdAt.toISOString(),
    postedByName: row.postedBy?.name ?? null,
    postedAtIso: row.postedAt ? row.postedAt.toISOString() : null,
    notes: row.notes ?? null,
    totalQty: total.toString(),
    lines: row.lines.map((l) => ({
      productName: l.product.productName,
      qty: l.qty.toString(),
      uom:
        l.product.uom?.trim() ||
        uomForBottled(l.product.productCat?.isBottled === true),
      storageLocationName: l.storageLocation.name,
    })),
  };
}

export async function getTransferDetailForSession(
  session: AuthSession,
  transferId: string,
  options?: { forReceive?: boolean },
): Promise<MobileTransferDetail | null> {
  await assertStockAccessForSession(session);
  const prisma = getPrismaClient();
  const scopedSalesPointId = await scopedSalesPointIdForSession(session);
  const id = String(transferId ?? "").trim();
  if (!id) return null;

  const row = await prisma.stockTransfer.findUnique({
    where: { id },
    include: {
      fromSalesPoint: { select: { name: true } },
      toSalesPoint: { select: { name: true } },
      createdBy: { select: { name: true } },
      dispatchedBy: { select: { name: true } },
      receivedBy: { select: { name: true } },
      lines: {
        include: {
          fromStorageLocation: { select: { name: true } },
          toStorageLocation: { select: { name: true } },
          product: {
            select: {
              productName: true,
              uom: true,
              productCat: { select: { isBottled: true } },
            },
          },
        },
        orderBy: { id: "asc" },
      },
    },
  });
  if (!row) return null;
  if (
    scopedSalesPointId != null &&
    row.fromSalesPointId !== scopedSalesPointId &&
    row.toSalesPointId !== scopedSalesPointId
  ) {
    return null;
  }

  const total = row.lines.reduce(
    (acc, line) => acc.add(line.qty),
    new Prisma.Decimal(0),
  );

  let receiveLocations: MobileTransferDetail["receiveLocations"] = [];
  if (options?.forReceive && row.status === StockDocStatus.DISPATCHED) {
    const perms = await getPermissionsForSession(session);
    if (perms["ui:receive-stock-transfer"]) {
      receiveLocations = await prisma.storageLocation.findMany({
        where: { salesPointId: row.toSalesPointId },
        orderBy: [{ isDefault: "desc" }, { name: "asc" }],
        select: { id: true, name: true, isSellable: true },
      });
    }
  }

  return {
    id: row.id,
    transferNo: row.transferNo,
    fromSalesPointName: row.fromSalesPoint.name,
    toSalesPointName: row.toSalesPoint.name,
    status: row.status,
    dispatchedAtIso: row.dispatchedAt ? prismaDateToIso(row.dispatchedAt) : null,
    receivedAtIso: row.receivedAt ? prismaDateToIso(row.receivedAt) : null,
    createdByName: row.createdBy.name,
    createdAtIso: row.createdAt.toISOString(),
    dispatchedByName: row.dispatchedBy?.name ?? null,
    receivedByName: row.receivedBy?.name ?? null,
    notes: row.notes ?? null,
    totalQty: total.toString(),
    lines: row.lines.map((l) => ({
      id: l.id,
      productName: l.product.productName,
      qty: l.qty.toString(),
      uom:
        l.product.uom?.trim() ||
        uomForBottled(l.product.productCat?.isBottled === true),
      fromStorageLocationName: l.fromStorageLocation.name,
      toStorageLocationName: l.toStorageLocation?.name ?? null,
    })),
    receiveLocations,
  };
}

export async function postReceiptForSession(
  session: AuthSession,
  receiptId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const id = String(receiptId ?? "").trim();
  if (!id) return { ok: false, error: "Invalid receipt." };

  try {
    await assertStockAccessForSession(session);
    await assertPermissionKeyForSession(session, "ui:post-stock-receipt");
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Forbidden." };
  }

  const prisma = getPrismaClient();
  const actor = actorFromAuthSession(session);
  if (!actor?.isActive) return { ok: false, error: "Login required." };

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
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not post receipt.",
    };
  }
}

export async function dispatchTransferForSession(
  session: AuthSession,
  transferId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const id = String(transferId ?? "").trim();
  if (!id) return { ok: false, error: "Invalid transfer." };

  try {
    await assertStockAccessForSession(session);
    await assertPermissionKeyForSession(session, "ui:dispatch-stock-transfer");
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Forbidden." };
  }

  const prisma = getPrismaClient();
  const actor = actorFromAuthSession(session);
  if (!actor?.isActive) return { ok: false, error: "Login required." };

  try {
    await prismaRetry(() =>
      prisma.$transaction(async (tx) => {
        const existing = await tx.stockTransfer.findUnique({
          where: { id },
          include: { lines: true },
        });
        if (!existing) throw new Error("Transfer not found.");
        const accessErr = salesPointErrorForResource(
          actor,
          existing.fromSalesPointId,
        );
        if (accessErr) throw new Error(accessErr);
        if (
          existing.status === StockDocStatus.DISPATCHED ||
          existing.status === StockDocStatus.RECEIVED
        ) {
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
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not dispatch transfer.",
    };
  }
}

export async function receiveTransferForSession(
  session: AuthSession,
  transferId: string,
  receiveLines?: Array<{ lineId: string; toStorageLocationId: number }>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const id = String(transferId ?? "").trim();
  if (!id) return { ok: false, error: "Invalid transfer." };

  try {
    await assertStockAccessForSession(session);
    await assertPermissionKeyForSession(session, "ui:receive-stock-transfer");
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Forbidden." };
  }

  const prisma = getPrismaClient();
  const actor = actorFromAuthSession(session);
  if (!actor?.isActive) return { ok: false, error: "Login required." };

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

        const defaultLocId = await resolveDefaultStorageLocationId(
          tx,
          existing.toSalesPointId,
        );

        const receiveByLineId = new Map(
          (receiveLines ?? []).map((l) => [l.lineId, l.toStorageLocationId]),
        );
        if (receiveLines && receiveLines.length !== existing.lines.length) {
          throw new Error("Assign a receive location for every line.");
        }

        const receivedAt = new Date();
        for (const line of existing.lines) {
          const toStorageLocationId =
            receiveByLineId.get(line.id) ??
            line.toStorageLocationId ??
            defaultLocId;
          await assertStorageLocationForSalesPoint(
            tx,
            existing.toSalesPointId,
            toStorageLocationId,
          );
          await tx.stockTransferLine.update({
            where: { id: line.id },
            data: { toStorageLocationId },
          });
          await applyMovement(tx, {
            salesPointId: existing.toSalesPointId,
            productId: line.productId,
            storageLocationId: toStorageLocationId,
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
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not receive transfer.",
    };
  }
}
