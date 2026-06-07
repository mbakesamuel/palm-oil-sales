import "server-only";

import { ValidationStatus } from "@prisma/client";
import type { AuthSession } from "@/lib/auth-session";
import { assertPermissionKeyForSession } from "@/lib/access-control";
import {
  canValidateConsignmentNote,
  effectiveSessionRole,
} from "@/lib/auth-roles";
import {
  actorFromAuthSession,
  salesPointErrorForResource,
} from "@/lib/auth-sales-point-scope";
import { getPrismaClient } from "@/lib/prisma";
import { prismaDateToIso } from "@/lib/posting-calendar";
import {
  commercialServiceErrorForOperations,
  commercialServiceErrorForResource,
  mergeWhereWithServiceScope,
  resolveServiceScope,
} from "@/lib/service-scope";
import { actorRequiresFixedPostingSite } from "@/lib/sales-point-assignment";

export type MobilePendingConsignmentRow = {
  id: string;
  consignmentNoteNo: string;
  invoiceNo: string;
  customerName: string;
  destination: string;
  vehicleNumber: string;
  dateOfConsignmentIso: string;
  salesPointName: string | null;
};

export type MobileConsignmentDetail = {
  id: string;
  consignmentNoteNo: string;
  status: string;
  invoiceNo: string;
  customerName: string;
  salesPointName: string | null;
  destination: string;
  vehicleNumber: string;
  dateOfLiftingIso: string;
  dateOfConsignmentIso: string;
  consignerName: string;
  consignerDesignation: string;
  receiverName: string;
  receiverNicNo: string;
  receiverNicPlaceOfIssue: string;
  receivedDateIso: string | null;
  deliveryOrderNo: string | null;
  createdByName: string;
  validatedByName: string | null;
  validatedAtIso: string | null;
  lines: Array<{
    lineNo: number;
    productName: string;
    qtyKg: string;
  }>;
};

function canValidateConsignmentForSession(session: AuthSession): boolean {
  return canValidateConsignmentNote(effectiveSessionRole(session));
}

export async function listPendingConsignmentNotesForSession(
  session: AuthSession,
): Promise<MobilePendingConsignmentRow[]> {
  await assertPermissionKeyForSession(session, "route:/consignment-notes");
  if (!canValidateConsignmentForSession(session)) return [];

  const prisma = getPrismaClient();
  const actor = actorFromAuthSession(session);
  if (!actor?.isActive) return [];

  const scope = resolveServiceScope(session);
  if (commercialServiceErrorForOperations(scope)) return [];

  const saleBase: { salesPointId?: number } = {};
  if (actorRequiresFixedPostingSite(actor) && actor.salesPointId != null) {
    saleBase.salesPointId = actor.salesPointId;
  }

  const rows = await prisma.vehicleConsignmentNote.findMany({
    where: {
      status: ValidationStatus.PENDING,
      sale: mergeWhereWithServiceScope(saleBase, scope),
    },
    orderBy: [{ dateOfConsignment: "desc" }, { consignmentNoteNo: "desc" }],
    take: 200,
    select: {
      id: true,
      consignmentNoteNo: true,
      destination: true,
      dateOfConsignment: true,
      vehicleNumber: true,
      sale: {
        select: {
          invoiceNo: true,
          customerNameSnapshot: true,
          salesPoint: { select: { name: true } },
        },
      },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    consignmentNoteNo: r.consignmentNoteNo,
    invoiceNo: r.sale.invoiceNo,
    customerName: r.sale.customerNameSnapshot,
    destination: r.destination,
    vehicleNumber: r.vehicleNumber,
    dateOfConsignmentIso: prismaDateToIso(r.dateOfConsignment),
    salesPointName: r.sale.salesPoint?.name ?? null,
  }));
}

export async function loadConsignmentDetailForSession(
  session: AuthSession,
  noteId: string,
): Promise<MobileConsignmentDetail | null> {
  await assertPermissionKeyForSession(session, "route:/consignment-notes");
  if (!canValidateConsignmentForSession(session)) return null;

  const prisma = getPrismaClient();
  const actor = actorFromAuthSession(session);
  if (!actor?.isActive) return null;

  const scope = resolveServiceScope(session);
  const id = String(noteId ?? "").trim();
  if (!id) return null;

  const row = await prisma.vehicleConsignmentNote.findUnique({
    where: { id },
    include: {
      createdBy: { select: { name: true } },
      validatedBy: { select: { name: true } },
      sale: {
        include: {
          salesPoint: { select: { name: true } },
          customer: { select: { name: true } },
          lines: {
            include: { product: { select: { productName: true } } },
            orderBy: { id: "asc" },
          },
        },
      },
    },
  });
  if (!row) return null;

  const accessErr = salesPointErrorForResource(actor, row.sale.salesPointId ?? null);
  if (accessErr) return null;
  const csErr = commercialServiceErrorForResource(
    scope,
    row.sale.commercialServiceId,
  );
  if (csErr) return null;

  return {
    id: row.id,
    consignmentNoteNo: row.consignmentNoteNo,
    status: row.status,
    invoiceNo: row.sale.invoiceNo,
    customerName: row.sale.customerNameSnapshot,
    salesPointName: row.sale.salesPoint?.name ?? null,
    destination: row.destination,
    vehicleNumber: row.vehicleNumber,
    dateOfLiftingIso: prismaDateToIso(row.dateOfLifting),
    dateOfConsignmentIso: prismaDateToIso(row.dateOfConsignment),
    consignerName: row.consignerName,
    consignerDesignation: row.consignerDesignation,
    receiverName: row.receiverName,
    receiverNicNo: row.receiverNicNo,
    receiverNicPlaceOfIssue: row.receiverNicPlaceOfIssue,
    receivedDateIso: row.receivedDate ? prismaDateToIso(row.receivedDate) : null,
    deliveryOrderNo: row.sale.deliveryOrderNo ?? null,
    createdByName: row.createdBy.name,
    validatedByName: row.validatedBy?.name ?? null,
    validatedAtIso: row.validatedAt?.toISOString() ?? null,
    lines: row.sale.lines.map((l, i) => ({
      lineNo: i + 1,
      productName: l.product.productName,
      qtyKg: l.qtyKg.toFixed(3),
    })),
  };
}

export async function validateConsignmentForSession(
  session: AuthSession,
  noteId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await assertPermissionKeyForSession(session, "route:/consignment-notes");

  if (!canValidateConsignmentForSession(session)) {
    return {
      ok: false,
      error: "Only supervisors can validate a vehicle consignment note.",
    };
  }

  const prisma = getPrismaClient();
  const actor = actorFromAuthSession(session);
  if (!actor?.isActive) {
    return { ok: false, error: "Login required." };
  }

  const id = String(noteId ?? "").trim();
  if (!id) return { ok: false, error: "Invalid consignment note." };

  const existing = await prisma.vehicleConsignmentNote.findUnique({
    where: { id },
    include: { sale: { select: { salesPointId: true } } },
  });
  if (!existing) return { ok: false, error: "Consignment note not found." };

  const accessErr = salesPointErrorForResource(
    actor,
    existing.sale.salesPointId,
  );
  if (accessErr) return { ok: false, error: accessErr };
  if (existing.status === ValidationStatus.VALIDATED) return { ok: true };

  await prisma.vehicleConsignmentNote.update({
    where: { id },
    data: {
      status: ValidationStatus.VALIDATED,
      validatedAt: new Date(),
      validatedByUserId: session.userId,
    },
  });

  return { ok: true };
}
