import "server-only";

import { Prisma, ValidationStatus } from "@prisma/client";
import type { AuthSession } from "@/lib/auth-session";
import { getPermissionsForSession } from "@/lib/access-control";
import {
  actorFromAuthSession,
  salesPointErrorForResource,
} from "@/lib/auth-sales-point-scope";
import { getPrismaClient } from "@/lib/prisma";
import {
  commercialServiceErrorForOperations,
  commercialServiceErrorForResource,
  deliveryOrderWhereForScope,
  resolveServiceScope,
} from "@/lib/service-scope";

type Cursor = { id: number } | null;

export type ValidationQueueFilters = {
  q?: string | null;
  from?: string | null;
  to?: string | null;
  reviewed?: "only" | "exclude" | "all";
  salesPointId?: number | null;
};

export type MobileDeliveryOrderDetail = {
  id: number;
  deliveryOrderNo: string;
  dateIssuedIso: string;
  salesPointName: string;
  customerName: string;
  status: string;
  reviewedAtIso: string | null;
  reviewedByName: string | null;
  orderRef: string | null;
  totalAmountXaf: string;
  lines: Array<{
    productName: string;
    orderQty: string;
    orderUnit: string;
    amount: string | null;
  }>;
  payments: Array<{
    method: string;
    amount: string;
    reference: string | null;
  }>;
};

export type ValidationQueueRow = {
  id: number;
  deliveryOrderNo: string;
  dateIssuedIso: string;
  salesPointName: string;
  customerName: string;
  reviewedAtIso: string | null;
  reviewedByName: string | null;
  totalAmountXaf: string;
};

export type ValidationQueuePage = {
  rows: ValidationQueueRow[];
  nextCursor: Cursor;
  totalPending: number;
  totalReviewedPending: number;
  totalUnreviewedPending: number;
};

function isoToStartUtc(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

function isoToEndExclusiveUtc(iso: string): Date {
  const d = new Date(`${iso}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

function money2Print(value: Prisma.Decimal) {
  return value.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

function parseIsoDate(raw: unknown): string | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

async function requireValidationQueueActor(session: AuthSession) {
  const perms = await getPermissionsForSession(session);
  if (!perms["ui:validate-delivery-orders"]) {
    throw new Error("You do not have permission to validate delivery orders.");
  }

  const prisma = getPrismaClient();
  const actor = actorFromAuthSession(session);
  if (!actor?.isActive) throw new Error("Login required.");
  return { prisma, session, actor };
}

export async function listPendingDeliveryOrdersForSession(
  session: AuthSession,
  input?: {
    filters?: ValidationQueueFilters;
    cursor?: Cursor;
    pageSize?: number;
  },
): Promise<ValidationQueuePage> {
  const { prisma, actor } = await requireValidationQueueActor(session);

  const scope = resolveServiceScope(session);
  const csErr = commercialServiceErrorForOperations(scope);
  if (csErr) throw new Error(csErr);
  const scopeWhere = deliveryOrderWhereForScope(scope) ?? {};

  const pageSize = Math.min(Math.max(Number(input?.pageSize ?? 50) || 50, 10), 200);
  const filters = input?.filters ?? {};

  const fromIso = parseIsoDate(filters.from);
  const toIso = parseIsoDate(filters.to);

  const q = String(filters.q ?? "").trim();
  const reviewed = filters.reviewed ?? "all";

  const dateWhere =
    fromIso || toIso
      ? {
          dateIssued: {
            gte: fromIso ? isoToStartUtc(fromIso) : undefined,
            lt: toIso ? isoToEndExclusiveUtc(toIso) : undefined,
          },
        }
      : {};

  const reviewedWhere =
    reviewed === "only"
      ? { reviewedAt: { not: null as unknown as undefined } }
      : reviewed === "exclude"
        ? { reviewedAt: null }
        : {};

  const salesPointWhere =
    filters.salesPointId && Number.isFinite(Number(filters.salesPointId))
      ? { salesPointId: Number(filters.salesPointId) }
      : {};

  const baseWhere = {
    ...scopeWhere,
    ...dateWhere,
    ...reviewedWhere,
    ...salesPointWhere,
    status: ValidationStatus.PENDING,
  } satisfies Prisma.DeliveryOrderWhereInput;

  const [totalPending, totalReviewedPending, totalUnreviewedPending] =
    await Promise.all([
      prisma.deliveryOrder.count({
        where: { ...scopeWhere, status: ValidationStatus.PENDING },
      }),
      prisma.deliveryOrder.count({
        where: {
          ...scopeWhere,
          status: ValidationStatus.PENDING,
          reviewedAt: { not: null },
        },
      }),
      prisma.deliveryOrder.count({
        where: {
          ...scopeWhere,
          status: ValidationStatus.PENDING,
          reviewedAt: null,
        },
      }),
    ]);

  const rows = await prisma.deliveryOrder.findMany({
    where: {
      ...baseWhere,
      ...(q
        ? {
            OR: [
              { deliveryOrderNo: { contains: q, mode: "insensitive" } },
              { customer: { name: { contains: q, mode: "insensitive" } } },
            ],
          }
        : {}),
      ...(input?.cursor?.id ? { id: { lt: input.cursor.id } } : {}),
    },
    orderBy: [{ id: "desc" }],
    take: pageSize + 1,
    select: {
      id: true,
      deliveryOrderNo: true,
      dateIssued: true,
      salesPoint: { select: { name: true, id: true } },
      customer: { select: { name: true } },
      reviewedAt: true,
      reviewedBy: { select: { name: true } },
      details: { select: { amount: true } },
      commercialServiceId: true,
      salesPointId: true,
    },
  });

  const safe: typeof rows = [];
  for (const r of rows) {
    if (salesPointErrorForResource(actor, r.salesPointId)) continue;
    if (commercialServiceErrorForResource(scope, r.commercialServiceId)) continue;
    safe.push(r);
  }

  const slice = safe.slice(0, pageSize);
  const next = safe.length > pageSize ? { id: slice[slice.length - 1]!.id } : null;

  const out: ValidationQueueRow[] = slice.map((r) => {
    const total = r.details.reduce(
      (acc, d) => acc.add(d.amount ?? new Prisma.Decimal(0)),
      new Prisma.Decimal(0),
    );
    return {
      id: r.id,
      deliveryOrderNo: r.deliveryOrderNo,
      dateIssuedIso: r.dateIssued.toISOString().slice(0, 10),
      salesPointName: r.salesPoint.name,
      customerName: r.customer.name,
      reviewedAtIso: r.reviewedAt ? r.reviewedAt.toISOString() : null,
      reviewedByName: r.reviewedBy?.name ?? null,
      totalAmountXaf: total.gt(0)
        ? `${money2Print(total).toNumber().toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })} XAF`
        : "",
    };
  });

  return {
    rows: out,
    nextCursor: next,
    totalPending,
    totalReviewedPending,
    totalUnreviewedPending,
  };
}

export async function loadDeliveryOrderDetailForSession(
  session: AuthSession,
  deliveryOrderId: number,
): Promise<MobileDeliveryOrderDetail | null> {
  try {
    const { prisma, actor } = await requireValidationQueueActor(session);
    const id = Number(deliveryOrderId);
    if (!Number.isFinite(id)) return null;

    const scope = resolveServiceScope(session);
    const row = await prisma.deliveryOrder.findUnique({
      where: { id },
      include: {
        salesPoint: { select: { name: true } },
        customer: { select: { name: true } },
        reviewedBy: { select: { name: true } },
        details: {
          orderBy: { id: "asc" },
          include: { product: { select: { productName: true } } },
        },
        payments: { orderBy: { id: "asc" } },
      },
    });
    if (!row) return null;
    if (salesPointErrorForResource(actor, row.salesPointId)) return null;
    if (commercialServiceErrorForResource(scope, row.commercialServiceId)) return null;

    const total = row.details.reduce(
      (acc, d) => acc.add(d.amount ?? new Prisma.Decimal(0)),
      new Prisma.Decimal(0),
    );

    return {
      id: row.id,
      deliveryOrderNo: row.deliveryOrderNo,
      dateIssuedIso: row.dateIssued.toISOString().slice(0, 10),
      salesPointName: row.salesPoint.name,
      customerName: row.customer.name,
      status: row.status,
      reviewedAtIso: row.reviewedAt ? row.reviewedAt.toISOString() : null,
      reviewedByName: row.reviewedBy?.name ?? null,
      orderRef: row.orderRef ?? null,
      totalAmountXaf: total.gt(0)
        ? `${money2Print(total).toNumber().toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })} XAF`
        : "",
      lines: row.details.map((d) => ({
        productName: d.product.productName,
        orderQty: d.orderQty.toString(),
        orderUnit: d.orderUnit ?? "",
        amount: d.amount != null ? d.amount.toString() : null,
      })),
      payments: row.payments.map((p) => ({
        method: p.method,
        amount: p.paymentDate.toISOString().slice(0, 10),
        reference:
          p.chequeNo || p.bank
            ? [p.chequeNo, p.bank].filter(Boolean).join(" · ")
            : p.cashReceiptNo,
      })),
    };
  } catch {
    return null;
  }
}

export async function markDeliveryOrdersReviewedForSession(
  session: AuthSession,
  input: { ids: number[] },
): Promise<{ ok: true; updated: number } | { ok: false; error: string }> {
  try {
    const { prisma, actor } = await requireValidationQueueActor(session);
    const ids = (input.ids ?? []).filter((n) => Number.isFinite(n));
    if (ids.length === 0) return { ok: true, updated: 0 };

    const scope = resolveServiceScope(session);
    const existing = await prisma.deliveryOrder.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        status: true,
        salesPointId: true,
        commercialServiceId: true,
      },
    });

    const allowedIds: number[] = [];
    for (const r of existing) {
      if (r.status !== ValidationStatus.PENDING) continue;
      if (salesPointErrorForResource(actor, r.salesPointId)) continue;
      if (commercialServiceErrorForResource(scope, r.commercialServiceId)) continue;
      allowedIds.push(r.id);
    }

    if (allowedIds.length === 0) return { ok: true, updated: 0 };

    const res = await prisma.deliveryOrder.updateMany({
      where: { id: { in: allowedIds }, status: ValidationStatus.PENDING },
      data: { reviewedAt: new Date(), reviewedByUserId: session.userId },
    });

    return { ok: true, updated: res.count };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

export async function validateReviewedDeliveryOrdersForSession(
  session: AuthSession,
  input: { ids: number[] },
): Promise<
  | {
      ok: true;
      validated: number;
      skipped: number;
      errors: Array<{ id: number; error: string }>;
    }
  | { ok: false; error: string }
> {
  try {
    const { prisma, actor } = await requireValidationQueueActor(session);
    const ids = (input.ids ?? []).filter((n) => Number.isFinite(n));
    if (ids.length === 0) {
      return { ok: true, validated: 0, skipped: 0, errors: [] };
    }

    const scope = resolveServiceScope(session);
    const rows = await prisma.deliveryOrder.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        status: true,
        reviewedAt: true,
        salesPointId: true,
        commercialServiceId: true,
      },
    });

    const errors: Array<{ id: number; error: string }> = [];
    const eligible: number[] = [];
    let skipped = 0;

    for (const r of rows) {
      if (r.status === ValidationStatus.VALIDATED) {
        skipped += 1;
        continue;
      }
      if (r.status !== ValidationStatus.PENDING) {
        errors.push({ id: r.id, error: "Not pending." });
        continue;
      }
      if (!r.reviewedAt) {
        errors.push({ id: r.id, error: "Not reviewed yet." });
        continue;
      }
      const spErr = salesPointErrorForResource(actor, r.salesPointId);
      if (spErr) {
        errors.push({ id: r.id, error: spErr });
        continue;
      }
      const csErr = commercialServiceErrorForResource(scope, r.commercialServiceId);
      if (csErr) {
        errors.push({ id: r.id, error: csErr });
        continue;
      }
      eligible.push(r.id);
    }

    if (eligible.length === 0) {
      return { ok: true, validated: 0, skipped, errors };
    }

    const now = new Date();
    const validated = await prisma.$transaction(async (tx) => {
      const res = await tx.deliveryOrder.updateMany({
        where: {
          id: { in: eligible },
          status: ValidationStatus.PENDING,
          reviewedAt: { not: null },
        },
        data: {
          status: ValidationStatus.VALIDATED,
          validatedAt: now,
          validatedByUserId: session.userId,
        },
      });
      return res.count;
    });

    return { ok: true, validated, skipped, errors };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}
