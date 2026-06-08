import "server-only";



import { ValidationStatus } from "@prisma/client";

import type { AuthSession } from "@/lib/auth-session";

import {

  assertPermissionKeyForSession,

  getPermissionsForSession,

} from "@/lib/access-control";

import {

  canValidateConsignmentForActor,

  effectiveSessionRole,

} from "@/lib/auth-roles";

import {

  actorFromAuthSession,

  fetchActorSalesPointScope,

  salesPointErrorForResource,

  type ActorSalesPointRow,

} from "@/lib/auth-sales-point-scope";

import {
  consignmentNoteAccessError,
  isSeniorSupervisorValidator,
} from "@/lib/pos/sale-validation-scope";

import { resolveBotaSalesPointId } from "@/lib/pos/sale-product-mode";

import { actorRequiresFixedPostingSite } from "@/lib/sales-point-assignment";

import type { PermissionKey } from "@/lib/access-control-keys";

import { getPrismaClient } from "@/lib/prisma";

import { prismaDateToIso } from "@/lib/posting-calendar";

import {

  commercialServiceErrorForOperations,

  commercialServiceErrorForResource,

  mergeWhereWithServiceScope,

  resolveServiceScope,

} from "@/lib/service-scope";

import type { UserRole } from "@/lib/domain";



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



async function loadConsignmentActor(

  session: AuthSession,

): Promise<{ actor: ActorSalesPointRow; storedUserRole: UserRole } | null> {

  const prisma = getPrismaClient();

  const [actor, user] = await Promise.all([

    fetchActorSalesPointScope(prisma, session.userId),

    prisma.user.findUnique({

      where: { id: session.userId },

      select: { role: true },

    }),

  ]);

  if (!actor?.isActive || !user) return null;

  return { actor, storedUserRole: user.role as UserRole };

}



function canValidateConsignmentSession(

  session: AuthSession,

  storedUserRole: UserRole,

  perms: Record<PermissionKey, boolean>,

): boolean {

  if (

    canValidateConsignmentForActor(

      effectiveSessionRole(session),

      storedUserRole,

    )

  ) {

    return true;

  }



  // Custom line role codes (e.g. "sas") — same gate as pending sales on mobile.

  if (!perms["ui:validate-documents"]) return false;



  const ctx = {

    role: effectiveSessionRole(session),

    commercialServiceRoleCode: session.commercialServiceRole?.code,

  };

  if (isSeniorSupervisorValidator(ctx)) return true;



  const actor = actorFromAuthSession(session);

  if (!actorRequiresFixedPostingSite(actor)) return false;

  return actor.salesPointId != null;

}



function consignmentAccessErrorForSession(

  session: AuthSession,

  actor: ActorSalesPointRow,

  salesPointId: number | null,

  botaSalesPointId: number | null,

): string | null {

  const ctx = {

    role: effectiveSessionRole(session),

    commercialServiceRoleCode: session.commercialServiceRole?.code,

  };

  return consignmentNoteAccessError(

    salesPointId,

    botaSalesPointId,

    ctx,

    salesPointErrorForResource(actor, salesPointId),

  );

}



export async function listPendingConsignmentNotesForSession(

  session: AuthSession,

): Promise<MobilePendingConsignmentRow[]> {

  const perms = await getPermissionsForSession(session);

  const actorCtx = await loadConsignmentActor(session);

  if (!actorCtx) return [];



  const canValidate = canValidateConsignmentSession(

    session,

    actorCtx.storedUserRole,

    perms,

  );

  if (!perms["ui:validate-documents"] && !canValidate) {

    return [];

  }

  await assertPermissionKeyForSession(session, "route:/consignment-notes");

  if (!canValidate) return [];



  const prisma = getPrismaClient();

  const { actor } = actorCtx;

  const scope = resolveServiceScope(session);

  if (commercialServiceErrorForOperations(scope)) return [];



  const botaSalesPointId = await resolveBotaSalesPointId(prisma);

  const rows = await prisma.vehicleConsignmentNote.findMany({

    where: {

      status: ValidationStatus.PENDING,

      sale: mergeWhereWithServiceScope({}, scope),

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

          salesPointId: true,

          commercialServiceId: true,

          salesPoint: { select: { name: true } },

        },

      },

    },

  });



  return rows

    .filter((r) => {

      if (

        consignmentAccessErrorForSession(

          session,

          actor,

          r.sale.salesPointId ?? null,

          botaSalesPointId,

        )

      ) {

        return false;

      }

      if (

        commercialServiceErrorForResource(scope, r.sale.commercialServiceId)

      ) {

        return false;

      }

      return true;

    })

    .map((r) => ({

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



  const [actorCtx, perms] = await Promise.all([

    loadConsignmentActor(session),

    getPermissionsForSession(session),

  ]);

  if (!actorCtx) return null;

  if (

    !canValidateConsignmentSession(session, actorCtx.storedUserRole, perms)

  ) {

    return null;

  }



  const prisma = getPrismaClient();

  const { actor } = actorCtx;

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



  const botaSalesPointId = await resolveBotaSalesPointId(prisma);

  const accessErr = consignmentAccessErrorForSession(

    session,

    actor,

    row.sale.salesPointId ?? null,

    botaSalesPointId,

  );

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



  const [actorCtx, perms] = await Promise.all([

    loadConsignmentActor(session),

    getPermissionsForSession(session),

  ]);

  if (!actorCtx) {

    return { ok: false, error: "Login required." };

  }

  if (

    !canValidateConsignmentSession(session, actorCtx.storedUserRole, perms)

  ) {

    return {

      ok: false,

      error: "Only supervisors can validate a vehicle consignment note.",

    };

  }



  const prisma = getPrismaClient();

  const { actor } = actorCtx;

  const id = String(noteId ?? "").trim();

  if (!id) return { ok: false, error: "Invalid consignment note." };



  const existing = await prisma.vehicleConsignmentNote.findUnique({

    where: { id },

    include: { sale: { select: { salesPointId: true } } },

  });

  if (!existing) return { ok: false, error: "Consignment note not found." };



  const botaSalesPointId = await resolveBotaSalesPointId(prisma);

  const accessErr = consignmentAccessErrorForSession(

    session,

    actor,

    existing.sale.salesPointId,

    botaSalesPointId,

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


