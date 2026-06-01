import "server-only";

import { Prisma, StockCondition, StockMovementKind, ValidationStatus } from "@prisma/client";
import type { AuthSession } from "@/lib/auth-session";
import {
  assertPermissionKeyForSession,
  getPermissionsForSession,
} from "@/lib/access-control";
import {
  canPickPendingPosSales,
  effectiveSessionRole,
} from "@/lib/auth-roles";
import { actorRequiresFixedPostingSite } from "@/lib/sales-point-assignment";
import { fetchActorSalesPointScope } from "@/lib/auth-sales-point-scope";
import { salesPointErrorForResource } from "@/lib/auth-sales-point-scope";
import { UserRole } from "@/lib/domain";
import { deliveryOrderPosUsageError } from "@/lib/delivery-order-sale-control";
import { getPrismaClient } from "@/lib/prisma";
import {
  commercialServiceErrorForOperations,
  commercialServiceErrorForResource,
  mergeWhereWithServiceScope,
  resolveServiceScope,
  saleWhereForScope,
} from "@/lib/service-scope";
import { isInsufficientStockError } from "@/lib/stock/errors";
import { assertPosLocationSellable } from "@/lib/stock/pos-location";
import { applyMovement } from "@/lib/stock/post";
import { resolveDefaultStorageLocationId } from "@/lib/stock/storage-location";

export type MobilePendingSaleRow = {
  id: string;
  invoiceNo: string;
  soldAtIso: string;
  customerName: string;
  totalLabel: string;
  salesPointName: string | null;
};

function money2Print(value: Prisma.Decimal) {
  return value.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

export async function listPendingSalesForSession(
  session: AuthSession,
): Promise<MobilePendingSaleRow[]> {
  await assertPermissionKeyForSession(session, "route:/pos");

  const prisma = getPrismaClient();
  const actor = await fetchActorSalesPointScope(prisma, session.userId);
  if (!actor?.isActive) return [];

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

  const salesPointFilter =
    actor.salesPointId != null && actorRequiresFixedPostingSite(actor)
      ? { salesPointId: actor.salesPointId }
      : {};

  const rows = await prisma.sale.findMany({
    where: mergeWhereWithServiceScope(
      {
        status: ValidationStatus.PENDING,
        ...salesPointFilter,
        lines: {
          some: { product: { productCat: { isBottled: false } } },
        },
      },
      scope,
      saleWhereForScope,
    ),
    orderBy: [{ soldAt: "desc" }, { invoiceNo: "desc" }],
    take: 200,
    select: {
      id: true,
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
      id: r.id,
      invoiceNo: r.invoiceNo,
      soldAtIso: r.soldAt.toISOString().slice(0, 10),
      customerName: r.customerNameSnapshot,
      totalLabel: fmt,
      salesPointName: r.salesPoint?.name ?? null,
    };
  });
}

export async function validateSaleForSession(
  session: AuthSession,
  saleId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const prisma = getPrismaClient();
  const id = String(saleId ?? "").trim();
  if (!id) return { ok: false, error: "Invalid sale." };

  await assertPermissionKeyForSession(session, "route:/pos");
  const perms = await getPermissionsForSession(session);
  if (!perms["ui:validate-documents"]) {
    return {
      ok: false,
      error: "You do not have permission to validate sales invoices.",
    };
  }

  const actor = await fetchActorSalesPointScope(prisma, session.userId);
  if (!actor?.isActive) {
    return { ok: false, error: "Login required." };
  }

  const scope = resolveServiceScope(session);

  const existing = await prisma.sale.findUnique({
    where: { id },
    select: {
      status: true,
      salesPointId: true,
      commercialServiceId: true,
      deliveryOrderNo: true,
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
  if (existing.salesPointId == null) {
    return {
      ok: false,
      error: "This invoice has no sales point; cannot deduct stock on validation.",
    };
  }
  const stockSalesPointId: number = existing.salesPointId;
  if (!existing.deliveryOrderNo) {
    return { ok: false, error: "Delivery Order number is required." };
  }

  const linkedDo = await prisma.deliveryOrder.findUnique({
    where: { deliveryOrderNo: existing.deliveryOrderNo },
    select: { status: true },
  });
  const doStatusErr = deliveryOrderPosUsageError(linkedDo?.status);
  if (doStatusErr) {
    return { ok: false, error: doStatusErr };
  }

  try {
    await prisma.$transaction(
      async (tx) => {
        for (const line of existing.lines) {
          const storageLocationId =
            line.storageLocationId ??
            (await resolveDefaultStorageLocationId(tx, stockSalesPointId));
          await assertPosLocationSellable(tx, {
            salesPointId: stockSalesPointId,
            storageLocationId,
            productId: line.productId,
          });
          const qty = line.product.productCat?.isBottled
            ? (line.qtyUnits ?? line.qtyKg)
            : line.qtyKg;
          if (new Prisma.Decimal(qty).lte(0)) continue;
          await applyMovement(tx, {
            salesPointId: stockSalesPointId,
            productId: line.productId,
            storageLocationId,
            condition: StockCondition.SELLABLE,
            qty,
            kind: StockMovementKind.SALE,
            occurredAt: existing.soldAt,
            userId: session.userId,
            sourceKind: "SALE",
            sourceId: id,
          });
        }

        await tx.sale.update({
          where: { id },
          data: {
            status: ValidationStatus.VALIDATED,
            validatedAt: new Date(),
            validatedByUserId: session.userId,
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (e) {
    if (isInsufficientStockError(e)) {
      return { ok: false, error: e.message };
    }
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not validate sale.",
    };
  }

  return { ok: true };
}

export async function canValidateSalesForSession(
  session: AuthSession,
): Promise<boolean> {
  const perms = await getPermissionsForSession(session);
  return Boolean(perms["ui:validate-documents"]);
}

export async function canAccessDoValidationQueue(
  session: AuthSession,
): Promise<boolean> {
  if (session.role !== UserRole.MANAGER) return false;
  const perms = await getPermissionsForSession(session);
  return Boolean(perms["route:/delivery-orders/validation-queue"]);
}
