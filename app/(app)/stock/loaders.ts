import "server-only";

import { getPermissionsForSession } from "@/lib/access-control";
import {
  fetchActorSalesPointScope,
  type ActorSalesPointRow,
} from "@/lib/auth-sales-point-scope";
import { getPrismaClient } from "@/lib/prisma";
import { actorRequiresFixedPostingSite } from "@/lib/sales-point-assignment";
import { prismaDateToIso } from "@/lib/posting-calendar";
import type { AuthSession } from "@/lib/auth-session";
import {
  assertStockPageActionAccess,
  assertFullStockActionAccess,
} from "@/lib/stock/stock-page-access-server";
import {
  Prisma,
  StockCondition,
  StockDocStatus,
  StockMovementKind,
  UserRole,
} from "@prisma/client";

export type SalesPointOption = { id: number; name: string };
export type StorageLocationOption = {
  id: number;
  salesPointId: number;
  name: string;
  isDefault: boolean;
  isSellable: boolean;
};
export type ProductOption = {
  productId: number;
  productName: string;
  uom: string;
  isBottled: boolean;
};

export type StockBalanceRow = {
  salesPointId: number;
  salesPointName: string;
  storageLocationId: number;
  storageLocationName: string;
  productId: number;
  productName: string;
  uom: string;
  condition: StockCondition;
  qty: string;
};

export type StockMovementRow = {
  id: string;
  occurredAtIso: string;
  salesPointId: number;
  salesPointName: string;
  storageLocationId: number;
  storageLocationName: string;
  productId: number;
  productName: string;
  uom: string;
  kind: StockMovementKind;
  condition: StockCondition;
  qty: string;
  sourceKind: string;
  sourceId: string;
  documentNo: string | null;
  userId: string;
  userName: string;
  notes: string | null;
  createdAtIso: string;
};

export type ReceiptListRow = {
  id: string;
  receiptNo: string;
  salesPointId: number;
  salesPointName: string;
  receivedAtIso: string;
  supplierLabel: string;
  status: StockDocStatus;
  totalQty: string;
  lineCount: number;
  createdByName: string;
  postedByName: string | null;
  postedAtIso: string | null;
  createdAtIso: string;
};

export type ReceiptDetail = ReceiptListRow & {
  notes: string | null;
  lines: {
    id: string;
    productId: number;
    productName: string;
    uom: string;
    qty: string;
    storageLocationId: number;
    storageLocationName: string;
  }[];
};

export type TransferListRow = {
  id: string;
  transferNo: string;
  fromSalesPointId: number;
  fromSalesPointName: string;
  toSalesPointId: number;
  toSalesPointName: string;
  dispatchedAtIso: string | null;
  receivedAtIso: string | null;
  status: StockDocStatus;
  totalQty: string;
  lineCount: number;
  createdByName: string;
  dispatchedByName: string | null;
  receivedByName: string | null;
  createdAtIso: string;
};

export type TransferDetail = TransferListRow & {
  notes: string | null;
  lines: {
    id: string;
    productId: number;
    productName: string;
    uom: string;
    qty: string;
    fromStorageLocationId: number;
    fromStorageLocationName: string;
    toStorageLocationId: number | null;
    toStorageLocationName: string | null;
  }[];
};

export type AdjustmentListRow = {
  id: string;
  adjustmentNo: string;
  salesPointId: number;
  salesPointName: string;
  occurredAtIso: string;
  reason: string;
  status: StockDocStatus;
  lineCount: number;
  createdByName: string;
  postedByName: string | null;
  postedAtIso: string | null;
  createdAtIso: string;
};

export type AdjustmentDetail = AdjustmentListRow & {
  lines: {
    id: string;
    productId: number;
    productName: string;
    uom: string;
    deltaQty: string;
    storageLocationId: number;
    storageLocationName: string;
  }[];
};

export type StockBootstrap = {
  canManageReceipts: boolean;
  canDispatchTransfers: boolean;
  canReceiveTransfers: boolean;
  canPostAdjustments: boolean;
  canReclassifyStock: boolean;
  canCancelDocuments: boolean;
  canDraftReceipts: boolean;
  canDraftTransfers: boolean;
  scopedSalesPointId: number | null;
  salesPoints: SalesPointOption[];
  storageLocations: StorageLocationOption[];
  products: ProductOption[];
  onHand: StockBalanceRow[];
  movements: StockMovementRow[];
  receipts: ReceiptListRow[];
  transfers: TransferListRow[];
  adjustments: AdjustmentListRow[];
};

/**
 * Drafting stock documents is a clerk responsibility — supervisors and managers
 * validate (post / dispatch) instead of creating drafts. This helper returns
 * `false` for supervisor / manager-level roles at both the global (UserRole)
 * and line (CommercialServiceRole.code) levels so the UI hides the "New
 * receipt" / "New transfer" buttons for them.
 *
 * "Senior" supervisors stay enabled (they may need to step in across sales
 * points) and admins / clerks / officers / directors keep their existing
 * ability to draft.
 */
function canDraftStockDocumentsForSession(session: AuthSession): boolean {
  if (session.role === UserRole.SUPERVISOR || session.role === UserRole.MANAGER) {
    return false;
  }
  const csrCode = session.commercialServiceRole?.code?.toLowerCase() ?? "";
  if (csrCode.includes("supervisor") && !csrCode.includes("senior")) return false;
  return true;
}

function uomForBottled(isBottled: boolean): string {
  return isBottled ? "Unit" : "Kg";
}

async function salesPointScopeForActor(
  prisma: ReturnType<typeof getPrismaClient>,
  userId: string,
): Promise<{ actor: ActorSalesPointRow | null; scopedSalesPointId: number | null }> {
  const actor = await fetchActorSalesPointScope(prisma, userId);
  if (!actor) return { actor: null, scopedSalesPointId: null };
  if (actorRequiresFixedPostingSite(actor)) {
    return { actor, scopedSalesPointId: actor.salesPointId ?? null };
  }
  return { actor, scopedSalesPointId: null };
}

export async function loadStockBootstrap(): Promise<StockBootstrap> {
  const session = await assertStockPageActionAccess();
  const prisma = getPrismaClient();
  const { scopedSalesPointId } = await salesPointScopeForActor(prisma, session.userId);

  const permissions = await getPermissionsForSession(session);

  const [salesPoints, storageLocations, products, onHand, movements, receipts, transfers, adjustments] =
    await Promise.all([
      prisma.salesPoint.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      prisma.storageLocation.findMany({
        orderBy: [{ salesPointId: "asc" }, { name: "asc" }],
        select: {
          id: true,
          salesPointId: true,
          name: true,
          isDefault: true,
          isSellable: true,
        },
      }),
      prisma.product.findMany({
        orderBy: { productName: "asc" },
        select: {
          productId: true,
          productName: true,
          uom: true,
          productCat: { select: { isBottled: true } },
        },
      }),
      loadOnHand(prisma, scopedSalesPointId),
      loadMovements(prisma, { scopedSalesPointId, limit: 200 }),
      loadReceipts(prisma, scopedSalesPointId),
      loadTransfers(prisma, scopedSalesPointId),
      loadAdjustments(prisma, scopedSalesPointId),
    ]);

  const canDraft = canDraftStockDocumentsForSession(session);

  return {
    canManageReceipts: permissions["ui:post-stock-receipt"],
    canDispatchTransfers: permissions["ui:dispatch-stock-transfer"],
    canReceiveTransfers: permissions["ui:receive-stock-transfer"],
    canPostAdjustments: permissions["ui:post-stock-adjustment"],
    canReclassifyStock: permissions["ui:reclassify-stock-condition"],
    canCancelDocuments: permissions["ui:cancel-stock-document"],
    canDraftReceipts: canDraft,
    canDraftTransfers: canDraft,
    scopedSalesPointId,
    salesPoints,
    storageLocations,
    products: products.map((p) => ({
      productId: p.productId,
      productName: p.productName,
      isBottled: p.productCat?.isBottled === true,
      uom: p.uom?.trim() || uomForBottled(p.productCat?.isBottled === true),
    })),
    onHand,
    movements,
    receipts,
    transfers,
    adjustments,
  };
}

async function loadOnHand(
  prisma: ReturnType<typeof getPrismaClient>,
  scopedSalesPointId: number | null,
): Promise<StockBalanceRow[]> {
  const where: Prisma.StockBalanceWhereInput =
    scopedSalesPointId != null ? { salesPointId: scopedSalesPointId } : {};

  const rows = await prisma.stockBalance.findMany({
    where,
    include: {
      salesPoint: { select: { name: true } },
      storageLocation: { select: { name: true } },
      product: {
        select: {
          productName: true,
          uom: true,
          productCat: { select: { isBottled: true } },
        },
      },
    },
    orderBy: [
      { salesPoint: { name: "asc" } },
      { storageLocation: { name: "asc" } },
      { product: { productName: "asc" } },
    ],
  });

  return rows.map((r) => ({
    salesPointId: r.salesPointId,
    salesPointName: r.salesPoint.name,
    storageLocationId: r.storageLocationId,
    storageLocationName: r.storageLocation.name,
    productId: r.productId,
    productName: r.product.productName,
    uom:
      r.product.uom?.trim() ||
      uomForBottled(r.product.productCat?.isBottled === true),
    condition: r.condition,
    qty: r.qty.toString(),
  }));
}

export type LoadMovementsArgs = {
  scopedSalesPointId: number | null;
  salesPointId?: number | null;
  productId?: number | null;
  kind?: StockMovementKind | null;
  fromIso?: string | null;
  toIso?: string | null;
  limit?: number;
};

async function loadMovements(
  prisma: ReturnType<typeof getPrismaClient>,
  args: LoadMovementsArgs,
): Promise<StockMovementRow[]> {
  const where: Prisma.StockMovementWhereInput = {};
  const effectiveSpId = args.scopedSalesPointId ?? args.salesPointId ?? null;
  if (effectiveSpId != null) where.salesPointId = effectiveSpId;
  if (args.productId != null) where.productId = args.productId;
  if (args.kind != null) where.kind = args.kind;
  if (args.fromIso || args.toIso) {
    where.occurredAt = {};
    if (args.fromIso) (where.occurredAt as Prisma.DateTimeFilter).gte = new Date(`${args.fromIso}T00:00:00.000Z`);
    if (args.toIso) (where.occurredAt as Prisma.DateTimeFilter).lte = new Date(`${args.toIso}T23:59:59.999Z`);
  }

  const limit = Math.min(Math.max(args.limit ?? 100, 1), 500);
  const rows = await prisma.stockMovement.findMany({
    where,
    include: {
      salesPoint: { select: { name: true } },
      storageLocation: { select: { name: true } },
      product: {
        select: {
          productName: true,
          uom: true,
          productCat: { select: { isBottled: true } },
        },
      },
      user: { select: { name: true } },
    },
    orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
    take: limit,
  });

  const sourceIds = {
    RECEIPT: rows.filter((r) => r.sourceKind === "RECEIPT").map((r) => r.sourceId),
    TRANSFER: rows.filter((r) => r.sourceKind === "TRANSFER").map((r) => r.sourceId),
    SALE: rows.filter((r) => r.sourceKind === "SALE").map((r) => r.sourceId),
    ADJUSTMENT: rows.filter((r) => r.sourceKind === "ADJUSTMENT").map((r) => r.sourceId),
  };

  const [receipts, transfers, sales, adjustments] = await Promise.all([
    sourceIds.RECEIPT.length
      ? prisma.stockReceipt.findMany({
          where: { id: { in: sourceIds.RECEIPT } },
          select: { id: true, receiptNo: true },
        })
      : Promise.resolve([] as { id: string; receiptNo: string }[]),
    sourceIds.TRANSFER.length
      ? prisma.stockTransfer.findMany({
          where: { id: { in: sourceIds.TRANSFER } },
          select: { id: true, transferNo: true },
        })
      : Promise.resolve([] as { id: string; transferNo: string }[]),
    sourceIds.SALE.length
      ? prisma.sale.findMany({
          where: { id: { in: sourceIds.SALE } },
          select: { id: true, invoiceNo: true },
        })
      : Promise.resolve([] as { id: string; invoiceNo: string }[]),
    sourceIds.ADJUSTMENT.length
      ? prisma.stockAdjustment.findMany({
          where: { id: { in: sourceIds.ADJUSTMENT } },
          select: { id: true, adjustmentNo: true },
        })
      : Promise.resolve([] as { id: string; adjustmentNo: string }[]),
  ]);

  const docNoById = new Map<string, string>();
  for (const r of receipts) docNoById.set(`RECEIPT:${r.id}`, r.receiptNo);
  for (const t of transfers) docNoById.set(`TRANSFER:${t.id}`, t.transferNo);
  for (const s of sales) docNoById.set(`SALE:${s.id}`, s.invoiceNo);
  for (const a of adjustments) docNoById.set(`ADJUSTMENT:${a.id}`, a.adjustmentNo);

  return rows.map((r) => ({
    id: r.id,
    occurredAtIso: r.occurredAt.toISOString(),
    salesPointId: r.salesPointId,
    salesPointName: r.salesPoint.name,
    storageLocationId: r.storageLocationId,
    storageLocationName: r.storageLocation.name,
    productId: r.productId,
    productName: r.product.productName,
    uom:
      r.product.uom?.trim() ||
      uomForBottled(r.product.productCat?.isBottled === true),
    kind: r.kind,
    condition: r.condition,
    qty: r.qty.toString(),
    sourceKind: r.sourceKind,
    sourceId: r.sourceId,
    documentNo: docNoById.get(`${r.sourceKind}:${r.sourceId}`) ?? null,
    userId: r.userId,
    userName: r.user.name,
    notes: r.notes ?? null,
    createdAtIso: r.createdAt.toISOString(),
  }));
}

async function loadReceipts(
  prisma: ReturnType<typeof getPrismaClient>,
  scopedSalesPointId: number | null,
): Promise<ReceiptListRow[]> {
  const where: Prisma.StockReceiptWhereInput =
    scopedSalesPointId != null ? { salesPointId: scopedSalesPointId } : {};

  const rows = await prisma.stockReceipt.findMany({
    where,
    include: {
      salesPoint: { select: { name: true } },
      createdBy: { select: { name: true } },
      postedBy: { select: { name: true } },
      lines: { select: { qty: true } },
    },
    orderBy: [{ receivedAt: "desc" }, { createdAt: "desc" }],
    take: 100,
  });

  return rows.map((r) => {
    const total = r.lines.reduce(
      (acc, line) => acc.add(line.qty),
      new Prisma.Decimal(0),
    );
    return {
      id: r.id,
      receiptNo: r.receiptNo,
      salesPointId: r.salesPointId,
      salesPointName: r.salesPoint.name,
      receivedAtIso: prismaDateToIso(r.receivedAt),
      supplierLabel: r.supplierLabel,
      status: r.status,
      totalQty: total.toString(),
      lineCount: r.lines.length,
      createdByName: r.createdBy.name,
      postedByName: r.postedBy?.name ?? null,
      postedAtIso: r.postedAt ? r.postedAt.toISOString() : null,
      createdAtIso: r.createdAt.toISOString(),
    };
  });
}

async function loadTransfers(
  prisma: ReturnType<typeof getPrismaClient>,
  scopedSalesPointId: number | null,
): Promise<TransferListRow[]> {
  const where: Prisma.StockTransferWhereInput =
    scopedSalesPointId != null
      ? {
          OR: [
            { fromSalesPointId: scopedSalesPointId },
            { toSalesPointId: scopedSalesPointId },
          ],
        }
      : {};

  const rows = await prisma.stockTransfer.findMany({
    where,
    include: {
      fromSalesPoint: { select: { name: true } },
      toSalesPoint: { select: { name: true } },
      createdBy: { select: { name: true } },
      dispatchedBy: { select: { name: true } },
      receivedBy: { select: { name: true } },
      lines: { select: { qty: true } },
    },
    orderBy: [{ createdAt: "desc" }],
    take: 100,
  });

  return rows.map((r) => {
    const total = r.lines.reduce(
      (acc, line) => acc.add(line.qty),
      new Prisma.Decimal(0),
    );
    return {
      id: r.id,
      transferNo: r.transferNo,
      fromSalesPointId: r.fromSalesPointId,
      fromSalesPointName: r.fromSalesPoint.name,
      toSalesPointId: r.toSalesPointId,
      toSalesPointName: r.toSalesPoint.name,
      dispatchedAtIso: r.dispatchedAt ? prismaDateToIso(r.dispatchedAt) : null,
      receivedAtIso: r.receivedAt ? prismaDateToIso(r.receivedAt) : null,
      status: r.status,
      totalQty: total.toString(),
      lineCount: r.lines.length,
      createdByName: r.createdBy.name,
      dispatchedByName: r.dispatchedBy?.name ?? null,
      receivedByName: r.receivedBy?.name ?? null,
      createdAtIso: r.createdAt.toISOString(),
    };
  });
}

async function loadAdjustments(
  prisma: ReturnType<typeof getPrismaClient>,
  scopedSalesPointId: number | null,
): Promise<AdjustmentListRow[]> {
  const where: Prisma.StockAdjustmentWhereInput =
    scopedSalesPointId != null ? { salesPointId: scopedSalesPointId } : {};

  const rows = await prisma.stockAdjustment.findMany({
    where,
    include: {
      salesPoint: { select: { name: true } },
      createdBy: { select: { name: true } },
      postedBy: { select: { name: true } },
      lines: { select: { id: true } },
    },
    orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
    take: 100,
  });

  return rows.map((r) => ({
    id: r.id,
    adjustmentNo: r.adjustmentNo,
    salesPointId: r.salesPointId,
    salesPointName: r.salesPoint.name,
    occurredAtIso: prismaDateToIso(r.occurredAt),
    reason: r.reason,
    status: r.status,
    lineCount: r.lines.length,
    createdByName: r.createdBy.name,
    postedByName: r.postedBy?.name ?? null,
    postedAtIso: r.postedAt ? r.postedAt.toISOString() : null,
    createdAtIso: r.createdAt.toISOString(),
  }));
}

export async function loadReceiptDetail(id: string): Promise<ReceiptDetail | null> {
  const session = await assertFullStockActionAccess();
  const prisma = getPrismaClient();
  const { scopedSalesPointId } = await salesPointScopeForActor(prisma, session.userId);

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
    salesPointId: row.salesPointId,
    salesPointName: row.salesPoint.name,
    receivedAtIso: prismaDateToIso(row.receivedAt),
    supplierLabel: row.supplierLabel,
    status: row.status,
    totalQty: total.toString(),
    lineCount: row.lines.length,
    createdByName: row.createdBy.name,
    postedByName: row.postedBy?.name ?? null,
    postedAtIso: row.postedAt ? row.postedAt.toISOString() : null,
    createdAtIso: row.createdAt.toISOString(),
    notes: row.notes ?? null,
    lines: row.lines.map((l) => ({
      id: l.id,
      productId: l.productId,
      productName: l.product.productName,
      uom:
        l.product.uom?.trim() ||
        uomForBottled(l.product.productCat?.isBottled === true),
      qty: l.qty.toString(),
      storageLocationId: l.storageLocationId,
      storageLocationName: l.storageLocation.name,
    })),
  };
}

export async function loadTransferDetail(id: string): Promise<TransferDetail | null> {
  const session = await assertFullStockActionAccess();
  const prisma = getPrismaClient();
  const { scopedSalesPointId } = await salesPointScopeForActor(prisma, session.userId);

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

  return {
    id: row.id,
    transferNo: row.transferNo,
    fromSalesPointId: row.fromSalesPointId,
    fromSalesPointName: row.fromSalesPoint.name,
    toSalesPointId: row.toSalesPointId,
    toSalesPointName: row.toSalesPoint.name,
    dispatchedAtIso: row.dispatchedAt ? prismaDateToIso(row.dispatchedAt) : null,
    receivedAtIso: row.receivedAt ? prismaDateToIso(row.receivedAt) : null,
    status: row.status,
    totalQty: total.toString(),
    lineCount: row.lines.length,
    createdByName: row.createdBy.name,
    dispatchedByName: row.dispatchedBy?.name ?? null,
    receivedByName: row.receivedBy?.name ?? null,
    createdAtIso: row.createdAt.toISOString(),
    notes: row.notes ?? null,
    lines: row.lines.map((l) => ({
      id: l.id,
      productId: l.productId,
      productName: l.product.productName,
      uom:
        l.product.uom?.trim() ||
        uomForBottled(l.product.productCat?.isBottled === true),
      qty: l.qty.toString(),
      fromStorageLocationId: l.fromStorageLocationId,
      fromStorageLocationName: l.fromStorageLocation.name,
      toStorageLocationId: l.toStorageLocationId,
      toStorageLocationName: l.toStorageLocation?.name ?? null,
    })),
  };
}

export async function loadAdjustmentDetail(id: string): Promise<AdjustmentDetail | null> {
  const session = await assertStockPageActionAccess();
  const prisma = getPrismaClient();
  const { scopedSalesPointId } = await salesPointScopeForActor(prisma, session.userId);

  const row = await prisma.stockAdjustment.findUnique({
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

  return {
    id: row.id,
    adjustmentNo: row.adjustmentNo,
    salesPointId: row.salesPointId,
    salesPointName: row.salesPoint.name,
    occurredAtIso: prismaDateToIso(row.occurredAt),
    reason: row.reason,
    status: row.status,
    lineCount: row.lines.length,
    createdByName: row.createdBy.name,
    postedByName: row.postedBy?.name ?? null,
    postedAtIso: row.postedAt ? row.postedAt.toISOString() : null,
    createdAtIso: row.createdAt.toISOString(),
    lines: row.lines.map((l) => ({
      id: l.id,
      productId: l.productId,
      productName: l.product.productName,
      uom:
        l.product.uom?.trim() ||
        uomForBottled(l.product.productCat?.isBottled === true),
      deltaQty: l.deltaQty.toString(),
      storageLocationId: l.storageLocationId,
      storageLocationName: l.storageLocation.name,
    })),
  };
}
