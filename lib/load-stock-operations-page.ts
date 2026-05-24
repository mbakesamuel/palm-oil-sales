import "server-only";

import { getBotaSalesPointId } from "@/lib/bpo";
import { getPermissionsForSession } from "@/lib/access-control";
import type { AuthSession } from "@/lib/auth-session";
import {
  roleMayRaiseBpoConsignmentSenderVoucher,
  roleRequiresSalesPoint,
} from "@/lib/auth-roles";
import { describeDatabaseError } from "@/lib/describe-database-error";
import { prismaDateToIso } from "@/lib/posting-calendar";
import { getPrismaClient } from "@/lib/prisma";
import { prismaRetry } from "@/lib/prisma-retry";
import type { UserRole as AppUserRole } from "@/lib/domain";
import { Prisma, StockMovementStatus, StockMovementType, UserRole } from "@prisma/client";

export type StockActivityItem = {
  id: string;
  kind: "receipt_loose" | "receipt_bottled" | "transfer" | "issue";
  atIso: string;
  title: string;
  subtitle: string;
  statusLabel: string | null;
  href: string | null;
};

export type StockOperationsPageData =
  | {
      ok: true;
      hubSalesPointId: number | null;
      isBotaUser: boolean;
      assignedSalesPointId: number | null;
      salesPointLocked: boolean;
      permissions: { receive: boolean; transfer: boolean; issue: boolean };
      activity: StockActivityItem[];
      receipts: {
        salesPoints: Array<{ id: number; name: string }>;
        looseProducts: Array<{ productId: number; productName: string }>;
        storageLocations: Array<{ id: number; name: string; salesPointId: number }>;
        looseReceipts: Array<{
          id: string;
          salesPointId: number;
          storageLocationId: number | null;
          storageLocationName: string;
          productId: number;
          productName: string;
          receivedAtIso: string;
          qtyReceivedKg: string;
          qtyRemainingKg: string;
          note: string | null;
          hasAllocations: boolean;
        }>;
        bottledSalesPoints: Array<{ id: number; name: string }>;
        bottledProducts: Array<{ productId: number; label: string }>;
        bottledReceipts: Array<{
          id: string;
          salesPointId: number;
          salesPointName: string;
          productId: number;
          productLabel: string;
          receivedAtIso: string;
          qtyReceivedUnits: string;
          qtyRemainingUnits: string;
          note: string | null;
          hasConsumption: boolean;
        }>;
        canEditBottledReceiptRows: boolean;
      };
      transfers: {
        salesPoints: Array<{ id: number; name: string }>;
        bottledProducts: Array<{ id: string; label: string }>;
        availability: Array<{
          salesPointId: number;
          productId: number;
          availableQtyUnits: string;
        }>;
        movements: Array<{
          id: string;
          voucherNo: string;
          status: StockMovementStatus;
          sourceSalesPointName: string;
          destinationSalesPointName: string;
          movementDateIso: string;
          note: string | null;
          discrepancyNote: string | null;
          canSenderValidate: boolean;
          canBotaValidate: boolean;
          canReject: boolean;
          canPrintReceiptVoucher: boolean;
          lines: Array<{
            id: string;
            productId: string;
            productLabel: string;
            voucherQty: string;
            actualQty: string | null;
          }>;
        }>;
        canCreateVoucher: boolean;
        canPrintCreatedVoucher: boolean;
      };
      issues: {
        bottledProducts: Array<{ id: string; label: string }>;
        movements: Array<{
          voucherNo: string;
          movementDateIso: string;
          reason: string | null;
          note: string | null;
          lines: Array<{ productLabel: string; qtyUnits: string }>;
        }>;
        canPost: boolean;
        botaAvailable: boolean;
      };
    }
  | { ok: false; missingSalesPoint: true }
  | { ok: false; dbError: { title: string; description: string } };

function buildActivityFeed(input: {
  looseReceipts: Array<{ id: string; receivedAtIso: string; productName: string; qtyReceivedKg: string }>;
  bottledReceipts: Array<{
    id: string;
    receivedAtIso: string;
    productLabel: string;
    salesPointName: string;
    qtyReceivedUnits: string;
  }>;
  transfers: Array<{
    id: string;
    voucherNo: string;
    movementDateIso: string;
    status: StockMovementStatus;
    sourceSalesPointName: string;
    destinationSalesPointName: string;
  }>;
  issues: Array<{
    voucherNo: string;
    movementDateIso: string;
    reason: string | null;
  }>;
}): StockActivityItem[] {
  const items: StockActivityItem[] = [
    ...input.looseReceipts.map((r) => ({
      id: `lot-${r.id}`,
      kind: "receipt_loose" as const,
      atIso: r.receivedAtIso,
      title: `Receipt · ${r.productName}`,
      subtitle: `${r.qtyReceivedKg} kg`,
      statusLabel: "Received",
      href: null,
    })),
    ...input.bottledReceipts.map((r) => ({
      id: `lot-b-${r.id}`,
      kind: "receipt_bottled" as const,
      atIso: r.receivedAtIso,
      title: `Receipt · ${r.productLabel}`,
      subtitle: `${r.salesPointName} · ${r.qtyReceivedUnits} units`,
      statusLabel: "Received",
      href: null,
    })),
    ...input.transfers.map((m) => ({
      id: `xfer-${m.id}`,
      kind: "transfer" as const,
      atIso: m.movementDateIso,
      title: m.voucherNo,
      subtitle: `${m.sourceSalesPointName} → ${m.destinationSalesPointName}`,
      statusLabel: m.status.replaceAll("_", " "),
      href: `/stock/movements/${m.id}`,
    })),
    ...input.issues.map((m) => ({
      id: `iss-${m.voucherNo}`,
      kind: "issue" as const,
      atIso: m.movementDateIso,
      title: m.voucherNo,
      subtitle: m.reason ?? "Outbound",
      statusLabel: "Posted",
      href: null,
    })),
  ];
  return items
    .sort((a, b) => (a.atIso < b.atIso ? 1 : a.atIso > b.atIso ? -1 : 0))
    .slice(0, 60);
}

export async function loadStockOperationsPage(session: AuthSession): Promise<StockOperationsPageData> {
  const scopedToSalesPoint = roleRequiresSalesPoint(session.role);
  const assignedSalesPointId = session.salesPoint?.id ?? null;

  if (scopedToSalesPoint && assignedSalesPointId == null) {
    return { ok: false, missingSalesPoint: true };
  }

  const prisma = getPrismaClient();
  const hubSalesPointId = await getBotaSalesPointId(prisma);
  const isBotaUser =
    hubSalesPointId != null && assignedSalesPointId != null && assignedSalesPointId === hubSalesPointId;

  const perms = await getPermissionsForSession(session);
  const permissions = {
    receive: Boolean(perms["route:/stock/receipts"]),
    transfer: Boolean(perms["route:/stock/movements"]),
    issue: Boolean(perms["route:/stock/issues"]),
  };

  const spFilter =
    scopedToSalesPoint && assignedSalesPointId != null ? { salesPointId: assignedSalesPointId } : {};

  const visibleSalesPointWhere =
    scopedToSalesPoint && assignedSalesPointId != null
      ? { id: assignedSalesPointId }
      : hubSalesPointId != null
        ? { id: { not: hubSalesPointId } }
        : {};

  const bottledReceiptWhere =
    scopedToSalesPoint && assignedSalesPointId != null
      ? { salesPointId: assignedSalesPointId }
      : hubSalesPointId != null
        ? { salesPointId: { not: hubSalesPointId } }
        : {};

  const isBotaBpoClerk =
    session.role === UserRole.CLERK_IN_CHARGE_BPO &&
    assignedSalesPointId != null &&
    assignedSalesPointId === hubSalesPointId;
  const movementStatusFilter = isBotaBpoClerk
    ? StockMovementStatus.SENDER_VALIDATED
    : { not: StockMovementStatus.REJECTED };

  const stockScope =
    scopedToSalesPoint && assignedSalesPointId != null
      ? { salesPointId: assignedSalesPointId }
      : hubSalesPointId != null
        ? { salesPointId: { not: hubSalesPointId } }
        : {};

  try {
    const [
      salesPointsReceipt,
      looseProducts,
      storageLocations,
      looseReceiptsRaw,
      bottledSalesPoints,
      bottledProductsRaw,
      bottledReceiptsRaw,
      salesPointsXfer,
      bottledProductsXfer,
      transfersRaw,
      stockRows,
      openReservations,
      bottledProductsIssue,
      issuesRaw,
    ] = await Promise.all([
      prismaRetry(() =>
        prisma.salesPoint.findMany({
          where: spFilter.salesPointId != null ? { id: spFilter.salesPointId } : {},
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        }),
      ),
      prismaRetry(() =>
        prisma.product.findMany({
          where: { form: "LOOSE" },
          orderBy: { productName: "asc" },
          select: { productId: true, productName: true },
        }),
      ),
      prismaRetry(() =>
        prisma.storageLocation.findMany({
          where: spFilter,
          orderBy: { name: "asc" },
          select: { id: true, name: true, salesPointId: true },
        }),
      ),
      prismaRetry(() =>
        prisma.stockLot.findMany({
          where: { ...spFilter, uom: "KG" },
          orderBy: { receivedAt: "desc" },
          take: 100,
          select: {
            id: true,
            salesPointId: true,
            storageLocationId: true,
            productId: true,
            receivedAt: true,
            qtyReceived: true,
            qtyRemaining: true,
            note: true,
            _count: { select: { allocations: true } },
            product: { select: { productName: true } },
            storageLocation: { select: { name: true } },
          },
        }),
      ),
      prismaRetry(() =>
        prisma.salesPoint.findMany({
          where: visibleSalesPointWhere,
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        }),
      ),
      prismaRetry(() =>
        prisma.product.findMany({
          where: { form: "BOTTLED" },
          orderBy: { productName: "asc" },
          select: { productId: true, productName: true },
        }),
      ),
      prismaRetry(() =>
        prisma.stockLot.findMany({
          where: { ...bottledReceiptWhere, uom: "UNIT" },
          orderBy: { receivedAt: "desc" },
          take: 100,
          select: {
            id: true,
            salesPointId: true,
            productId: true,
            receivedAt: true,
            qtyReceived: true,
            qtyRemaining: true,
            note: true,
            salesPoint: { select: { name: true } },
            product: { select: { productName: true } },
            _count: { select: { allocations: true } },
          },
        }),
      ),
      prismaRetry(() =>
        prisma.salesPoint.findMany({
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        }),
      ),
      prismaRetry(() =>
        prisma.product.findMany({
          where: { form: "BOTTLED" },
          orderBy: { productName: "asc" },
          select: { productId: true, productName: true },
        }),
      ),
      prismaRetry(() =>
        prisma.stockMovement.findMany({
          where: {
            movementType: "TRANSFER",
            ...(scopedToSalesPoint && assignedSalesPointId != null
              ? {
                  status: movementStatusFilter,
                  OR: [
                    { sourceSalesPointId: assignedSalesPointId },
                    { destinationSalesPointId: assignedSalesPointId },
                  ],
                }
              : { status: movementStatusFilter }),
          },
          orderBy: [{ createdAt: "desc" }],
          take: 100,
          include: {
            sourceSalesPoint: { select: { name: true } },
            destinationSalesPoint: { select: { name: true } },
            lines: {
              include: { product: { select: { productName: true } } },
              orderBy: { id: "asc" },
            },
          },
        }),
      ),
      prismaRetry(() =>
        prisma.stockLot.findMany({
          where: { ...stockScope, qtyRemaining: { gt: 0 } },
          select: { salesPointId: true, productId: true, qtyRemaining: true },
        }),
      ),
      prismaRetry(() =>
        prisma.stockMovement.findMany({
          where:
            scopedToSalesPoint && assignedSalesPointId != null
              ? {
                  sourceSalesPointId: assignedSalesPointId,
                  status: { in: [StockMovementStatus.DRAFT, StockMovementStatus.SENDER_VALIDATED] },
                }
              : {
                  status: { in: [StockMovementStatus.DRAFT, StockMovementStatus.SENDER_VALIDATED] },
                  ...(hubSalesPointId != null
                    ? { sourceSalesPointId: { not: hubSalesPointId } }
                    : {}),
                },
          select: {
            sourceSalesPointId: true,
            lines: { select: { productId: true, voucherQty: true } },
          },
        }),
      ),
      prismaRetry(() =>
        prisma.product.findMany({
          where: { form: "BOTTLED" },
          orderBy: { productName: "asc" },
          select: { productId: true, productName: true },
        }),
      ),
      prismaRetry(() =>
        prisma.stockMovement.findMany({
          where: {
            movementType: {
              in: [StockMovementType.ISSUE, StockMovementType.ISSUE_GIFT, StockMovementType.ISSUE_OTHER],
            },
            ...(hubSalesPointId != null ? { sourceSalesPointId: hubSalesPointId } : {}),
          },
          orderBy: { createdAt: "desc" },
          take: 50,
          include: {
            lines: { include: { product: { select: { productName: true } } } },
          },
        }),
      ),
    ]);

    const physicalBySpProduct = new Map<string, Prisma.Decimal>();
    for (const row of stockRows) {
      const key = `${row.salesPointId}:${row.productId}`;
      physicalBySpProduct.set(
        key,
        (physicalBySpProduct.get(key) ?? new Prisma.Decimal(0)).add(row.qtyRemaining),
      );
    }
    const reservedBySpProduct = new Map<string, Prisma.Decimal>();
    for (const movement of openReservations) {
      if (movement.sourceSalesPointId == null) continue;
      for (const line of movement.lines) {
        const key = `${movement.sourceSalesPointId}:${line.productId}`;
        reservedBySpProduct.set(
          key,
          (reservedBySpProduct.get(key) ?? new Prisma.Decimal(0)).add(line.voucherQty),
        );
      }
    }
    const availability = [...physicalBySpProduct.entries()].map(([key, physical]) => {
      const [salesPointIdRaw, productIdRaw] = key.split(":");
      const available = physical.sub(reservedBySpProduct.get(key) ?? new Prisma.Decimal(0));
      return {
        salesPointId: Number.parseInt(salesPointIdRaw, 10),
        productId: Number.parseInt(productIdRaw, 10),
        availableQtyUnits: (available.gt(0) ? available : new Prisma.Decimal(0)).toString(),
      };
    });

    const looseReceipts = looseReceiptsRaw.map((b) => ({
      id: b.id,
      salesPointId: b.salesPointId,
      storageLocationId: b.storageLocationId,
      storageLocationName: b.storageLocation?.name ?? "—",
      productId: b.productId,
      productName: b.product.productName,
      receivedAtIso: prismaDateToIso(b.receivedAt),
      qtyReceivedKg: b.qtyReceived.toString(),
      qtyRemainingKg: b.qtyRemaining.toString(),
      note: b.note,
      hasAllocations: b._count.allocations > 0,
    }));

    const bottledReceipts = bottledReceiptsRaw.map((row) => ({
      id: row.id,
      salesPointId: row.salesPointId,
      salesPointName: row.salesPoint.name,
      productId: row.productId,
      productLabel: row.product.productName,
      receivedAtIso: prismaDateToIso(row.receivedAt),
      qtyReceivedUnits: row.qtyReceived.toString(),
      qtyRemainingUnits: row.qtyRemaining.toString(),
      note: row.note,
      hasConsumption:
        row._count.allocations > 0 || !row.qtyReceived.equals(row.qtyRemaining),
    }));

    const transfers = transfersRaw.map((m) => ({
      id: m.id,
      voucherNo: m.voucherNo,
      status: m.status,
      sourceSalesPointName: m.sourceSalesPoint?.name ?? "—",
      destinationSalesPointName: m.destinationSalesPoint?.name ?? "—",
      movementDateIso: m.movementDate.toISOString().slice(0, 10),
      note: m.note,
      discrepancyNote: m.discrepancyNote,
      canSenderValidate:
        m.status === "DRAFT" &&
        session.role === UserRole.SUPERVISOR &&
        (!scopedToSalesPoint || m.sourceSalesPointId === assignedSalesPointId),
      canBotaValidate:
        m.status === "SENDER_VALIDATED" &&
        hubSalesPointId != null &&
        (session.role === UserRole.SENIOR_SUPERVISOR ||
          session.role === UserRole.MANAGER ||
          session.role === UserRole.ADMIN) &&
        (!scopedToSalesPoint || assignedSalesPointId === hubSalesPointId),
      canReject:
        m.status !== StockMovementStatus.VALIDATED &&
        m.status !== StockMovementStatus.REJECTED &&
        ((session.role === UserRole.SUPERVISOR &&
          hubSalesPointId != null &&
          assignedSalesPointId !== hubSalesPointId &&
          (!scopedToSalesPoint || m.sourceSalesPointId === assignedSalesPointId)) ||
          (session.role === UserRole.CLERK_IN_CHARGE_BPO &&
            hubSalesPointId != null &&
            assignedSalesPointId === hubSalesPointId &&
            m.destinationSalesPointId === hubSalesPointId)),
      canPrintReceiptVoucher:
        m.status === StockMovementStatus.SENDER_VALIDATED &&
        session.role === UserRole.CLERK_IN_CHARGE_BPO &&
        hubSalesPointId != null &&
        assignedSalesPointId === hubSalesPointId &&
        m.destinationSalesPointId === hubSalesPointId,
      lines: m.lines.map((l) => ({
        id: l.id,
        productId: String(l.productId),
        productLabel: l.product?.productName ?? "—",
        voucherQty: l.voucherQty.toString(),
        actualQty: l.actualQty?.toString() ?? null,
      })),
    }));

    const issues = issuesRaw.map((m) => ({
      voucherNo: m.voucherNo,
      movementDateIso: m.movementDate.toISOString().slice(0, 10),
      reason: m.reason,
      note: m.note,
      lines: m.lines.map((l) => ({
        productLabel: l.product?.productName ?? "—",
        qtyUnits: (l.postedQty ?? l.actualQty ?? l.voucherQty).toString(),
      })),
    }));

    const activity = buildActivityFeed({
      looseReceipts,
      bottledReceipts,
      transfers,
      issues,
    });

    return {
      ok: true,
      hubSalesPointId,
      isBotaUser,
      assignedSalesPointId,
      salesPointLocked: scopedToSalesPoint,
      permissions,
      activity,
      receipts: {
        salesPoints: salesPointsReceipt,
        looseProducts,
        storageLocations,
        looseReceipts,
        bottledSalesPoints,
        bottledProducts: bottledProductsRaw.map((p) => ({
          productId: p.productId,
          label: p.productName,
        })),
        bottledReceipts,
        canEditBottledReceiptRows: scopedToSalesPoint,
      },
      transfers: {
        salesPoints: salesPointsXfer,
        bottledProducts: bottledProductsXfer.map((p) => ({
          id: String(p.productId),
          label: p.productName,
        })),
        availability,
        movements: transfers,
        canCreateVoucher: roleMayRaiseBpoConsignmentSenderVoucher(session.role as AppUserRole),
        canPrintCreatedVoucher:
          session.role === UserRole.CLERK &&
          assignedSalesPointId != null &&
          assignedSalesPointId !== hubSalesPointId,
      },
      issues: {
        bottledProducts: bottledProductsIssue.map((p) => ({
          id: String(p.productId),
          label: p.productName,
        })),
        movements: issues,
        canPost:
          hubSalesPointId != null &&
          (!scopedToSalesPoint || assignedSalesPointId === hubSalesPointId),
        botaAvailable: hubSalesPointId != null,
      },
    };
  } catch (e) {
    const { title, description } = describeDatabaseError(e);
    return { ok: false, dbError: { title, description } };
  }
}
