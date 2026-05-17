"use server";

import { assertPermissionKey } from "@/lib/access-control";
import { allocateConsignmentNoteNo } from "@/lib/consignment-note-no";
import { getPrismaClient } from "@/lib/prisma";
import { getServerSession } from "@/lib/auth-server";
import {
  canCreateOrEditConsignmentNoteDraft,
  canValidateConsignmentNote,
} from "@/lib/auth-roles";
import {
  salesPointErrorForResource,
  salesPointErrorForSubmitted,
} from "@/lib/auth-sales-point-scope";
import type { ConsignmentNotePrintModel, DoContextDto } from "@/lib/consignment-note-types";
import { Prisma, ValidationStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { getOrInitCompanySettings } from "@/lib/settings";

export type { DoContextDto } from "@/lib/consignment-note-types";

export type LoadedConsignmentSaleFields = {
  id: string;
  invoiceNo: string;
  soldAtIso: string;
  salesPointId: number | null;
  salesPointName: string | null;
  customerId: string;
  customerName: string;
  customerAddress: string | null;
  vehicleNumber: string;
  deliveryOrderNo: string | null;
  status: ValidationStatus;
  thisSaleLiftedQtyKg: string;
};

export type LoadedConsignmentNoteFields = {
  id: string;
  consignmentNoteNo: string;
  destination: string;
  dateOfLifting: string;
  vehicleNumber: string;
  consignerName: string;
  consignerDesignation: string;
  dateOfConsignment: string;
  receiverName: string;
  receiverNicNo: string;
  receiverNicPlaceOfIssue: string;
  receivedDate: string | null;
  status: ValidationStatus;
  validatedByName: string | null;
  validatedAtIso: string | null;
};

export type LoadedConsignmentFormView = {
  sale: LoadedConsignmentSaleFields;
  note: LoadedConsignmentNoteFields | null;
  doContext: DoContextDto;
};

export type SaveConsignmentNoteResult =
  | { ok: true; id: string; consignmentNoteNo: string }
  | { ok: false; error: string };

export type MutationResult = { ok: true } | { ok: false; error: string };

async function requireActor(prisma: ReturnType<typeof getPrismaClient>) {
  const session = await getServerSession();
  if (!session?.userId) {
    throw new Error("Login required.");
  }
  const actor = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, role: true, salesPointId: true, isActive: true },
  });
  if (!actor?.isActive) throw new Error("Login required.");
  return { session, actor };
}

function revalidateConsignmentPaths(consignmentId: string) {
  revalidatePath("/consignment-notes");
  revalidatePath(`/consignment-notes/${consignmentId}`);
}

function noonUtcFromIsoDate(iso: string): Date {
  return new Date(`${iso.trim()}T12:00:00.000Z`);
}

async function computeDoContext(
  prisma: ReturnType<typeof getPrismaClient>,
  deliveryOrderNo: string | null,
): Promise<DoContextDto> {
  if (!deliveryOrderNo?.trim()) {
    return {
      deliveryOrderNo: null,
      paidQtyKg: "0",
      liftedQtyKg: "0",
      balanceQtyKg: "0",
    };
  }
  const doNo = deliveryOrderNo.trim();
  const order = await prisma.deliveryOrder.findUnique({
    where: { deliveryOrderNo: doNo },
    select: { details: { select: { orderQty: true } } },
  });
  let paidDec = new Prisma.Decimal(0);
  if (order?.details?.length) {
    for (const d of order.details) {
      paidDec = paidDec.add(new Prisma.Decimal(d.orderQty));
    }
  }

  const liftedAgg = await prisma.saleLine.aggregate({
    where: {
      sale: {
        deliveryOrderNo: doNo,
        status: ValidationStatus.VALIDATED,
      },
    },
    _sum: { qtyKg: true },
  });
  const liftedDec = liftedAgg._sum.qtyKg ?? new Prisma.Decimal(0);
  const balanceDec = paidDec.sub(liftedDec);

  return {
    deliveryOrderNo: doNo,
    paidQtyKg: paidDec.toFixed(3),
    liftedQtyKg: liftedDec.toFixed(3),
    balanceQtyKg: balanceDec.toFixed(3),
  };
}

function sumSaleLinesQtyKg(lines: { qtyKg: Prisma.Decimal }[]): Prisma.Decimal {
  let s = new Prisma.Decimal(0);
  for (const l of lines) {
    s = s.add(l.qtyKg);
  }
  return s;
}

async function toFormView(
  prisma: ReturnType<typeof getPrismaClient>,
  actor: Awaited<ReturnType<typeof requireActor>>["actor"],
  sale: {
    id: string;
    invoiceNo: string;
    soldAt: Date;
    salesPointId: number | null;
    salesPoint: { name: string } | null;
    customerId: string;
    customer: { name: string; address: string | null };
    vehicleNumber: string;
    deliveryOrderNo: string | null;
    status: ValidationStatus;
    lines: { qtyKg: Prisma.Decimal }[];
    consignmentNote: {
      id: string;
      consignmentNoteNo: string;
      destination: string;
      dateOfLifting: Date;
      vehicleNumber: string;
      consignerName: string;
      consignerDesignation: string;
      dateOfConsignment: Date;
      receiverName: string;
      receiverNicNo: string;
      receiverNicPlaceOfIssue: string;
      receivedDate: Date | null;
      status: ValidationStatus;
      validatedAt: Date | null;
      validatedBy: { name: string } | null;
    } | null;
  },
): Promise<LoadedConsignmentFormView | null> {
  const accessErr = salesPointErrorForResource(actor, sale.salesPointId);
  if (accessErr) return null;

  const thisLifted = sumSaleLinesQtyKg(sale.lines);
  const doContext = await computeDoContext(prisma, sale.deliveryOrderNo);

  const note = sale.consignmentNote;
  return {
    sale: {
      id: sale.id,
      invoiceNo: sale.invoiceNo,
      soldAtIso: sale.soldAt.toISOString(),
      salesPointId: sale.salesPointId,
      salesPointName: sale.salesPoint?.name ?? null,
      customerId: sale.customerId,
      customerName: sale.customer.name,
      customerAddress: sale.customer.address ?? null,
      vehicleNumber: sale.vehicleNumber,
      deliveryOrderNo: sale.deliveryOrderNo,
      status: sale.status,
      thisSaleLiftedQtyKg: thisLifted.toFixed(3),
    },
    note: note
      ? {
          id: note.id,
          consignmentNoteNo: note.consignmentNoteNo,
          destination: note.destination,
          dateOfLifting: note.dateOfLifting.toISOString().slice(0, 10),
          vehicleNumber: note.vehicleNumber,
          consignerName: note.consignerName,
          consignerDesignation: note.consignerDesignation,
          dateOfConsignment: note.dateOfConsignment.toISOString().slice(0, 10),
          receiverName: note.receiverName,
          receiverNicNo: note.receiverNicNo,
          receiverNicPlaceOfIssue: note.receiverNicPlaceOfIssue,
          receivedDate: note.receivedDate ? note.receivedDate.toISOString().slice(0, 10) : null,
          status: note.status,
          validatedByName: note.validatedBy?.name ?? null,
          validatedAtIso: note.validatedAt ? note.validatedAt.toISOString() : null,
        }
      : null,
    doContext,
  };
}

const saleInclude = {
  salesPoint: { select: { name: true } },
  customer: { select: { name: true, address: true } },
  lines: { select: { qtyKg: true } },
  consignmentNote: {
    include: {
      validatedBy: { select: { name: true } },
    },
  },
} as const;

export async function loadSaleForConsignmentByInvoice(
  rawInvoice: string,
): Promise<LoadedConsignmentFormView | null> {
  const invoiceNo = String(rawInvoice ?? "").trim();
  if (!invoiceNo) return null;

  const prisma = getPrismaClient();
  let actor: Awaited<ReturnType<typeof requireActor>>["actor"];
  try {
    await assertPermissionKey("route:/consignment-notes");
    ({ actor } = await requireActor(prisma));
  } catch {
    return null;
  }

  const sale = await prisma.sale.findUnique({
    where: { invoiceNo },
    include: saleInclude,
  });
  if (!sale) return null;

  return toFormView(prisma, actor, sale);
}

export async function loadConsignmentByVcnNo(rawNo: string): Promise<LoadedConsignmentFormView | null> {
  const consignmentNoteNo = String(rawNo ?? "").trim();
  if (!consignmentNoteNo) return null;

  const prisma = getPrismaClient();
  let actor: Awaited<ReturnType<typeof requireActor>>["actor"];
  try {
    await assertPermissionKey("route:/consignment-notes");
    ({ actor } = await requireActor(prisma));
  } catch {
    return null;
  }

  const row = await prisma.vehicleConsignmentNote.findUnique({
    where: { consignmentNoteNo },
    include: {
      validatedBy: { select: { name: true } },
      sale: { include: saleInclude },
    },
  });
  if (!row) return null;

  return toFormView(prisma, actor, { ...row.sale, consignmentNote: row });
}

/** Exposed for client refresh of DO totals after sale changes (same as embedded in load). */
export async function loadDoContextForSale(saleId: string): Promise<DoContextDto | null> {
  const id = String(saleId ?? "").trim();
  if (!id) return null;

  const prisma = getPrismaClient();
  try {
    await assertPermissionKey("route:/consignment-notes");
    await requireActor(prisma);
  } catch {
    return null;
  }

  const sale = await prisma.sale.findUnique({
    where: { id },
    select: { deliveryOrderNo: true, salesPointId: true },
  });
  if (!sale) return null;

  return computeDoContext(prisma, sale.deliveryOrderNo);
}

export async function saveConsignmentNote(formData: FormData): Promise<SaveConsignmentNoteResult> {
  const prisma = getPrismaClient();
  let session: Awaited<ReturnType<typeof requireActor>>["session"];
  let actor: Awaited<ReturnType<typeof requireActor>>["actor"];
  try {
    await assertPermissionKey("route:/consignment-notes");
    ({ session, actor } = await requireActor(prisma));
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Login required." };
  }

  if (!canCreateOrEditConsignmentNoteDraft(actor.role)) {
    return {
      ok: false,
      error: "Only clerks can create or edit a pending vehicle consignment note.",
    };
  }

  const saleId = String(formData.get("saleId") ?? "").trim();
  const noteIdRaw = String(formData.get("noteId") ?? "").trim();
  const destination = String(formData.get("destination") ?? "").trim();
  const dateOfLiftingRaw = String(formData.get("dateOfLifting") ?? "").trim();
  const vehicleNumber = String(formData.get("vehicleNumber") ?? "").trim();
  const consignerName = String(formData.get("consignerName") ?? "").trim();
  const consignerDesignation = String(formData.get("consignerDesignation") ?? "").trim();
  const dateOfConsignmentRaw = String(formData.get("dateOfConsignment") ?? "").trim();
  const receiverName = String(formData.get("receiverName") ?? "").trim();
  const receiverNicNo = String(formData.get("receiverNicNo") ?? "").trim();
  const receiverNicPlaceOfIssue = String(formData.get("receiverNicPlaceOfIssue") ?? "").trim();
  const receivedDateRaw = String(formData.get("receivedDate") ?? "").trim();

  if (!saleId) return { ok: false, error: "Sale is required." };
  if (!destination) return { ok: false, error: "Destination (To) is required." };
  if (!dateOfLiftingRaw) return { ok: false, error: "Date of lifting is required." };
  if (!vehicleNumber) return { ok: false, error: "Vehicle number is required." };
  if (!consignerName) return { ok: false, error: "Consigner name is required." };
  if (!consignerDesignation) return { ok: false, error: "Consigner designation is required." };
  if (!dateOfConsignmentRaw) return { ok: false, error: "Date of consignment is required." };
  if (!receiverName) return { ok: false, error: "Receiver name is required." };
  if (!receiverNicNo) return { ok: false, error: "Receiver NIC number is required." };
  if (!receiverNicPlaceOfIssue) return { ok: false, error: "Place of issue (NIC) is required." };

  const dateOfLifting = noonUtcFromIsoDate(dateOfLiftingRaw);
  const dateOfConsignment = noonUtcFromIsoDate(dateOfConsignmentRaw);
  if (Number.isNaN(dateOfLifting.getTime()) || Number.isNaN(dateOfConsignment.getTime())) {
    return { ok: false, error: "Invalid date." };
  }

  let receivedDate: Date | null = null;
  if (receivedDateRaw) {
    receivedDate = noonUtcFromIsoDate(receivedDateRaw);
    if (Number.isNaN(receivedDate.getTime())) {
      return { ok: false, error: "Invalid received date." };
    }
  }

  const sale = await prisma.sale.findUnique({
    where: { id: saleId },
    select: {
      id: true,
      salesPointId: true,
      status: true,
      consignmentNote: { select: { id: true, status: true } },
    },
  });
  if (!sale) return { ok: false, error: "Sale not found." };
  if (sale.status !== ValidationStatus.VALIDATED) {
    return { ok: false, error: "The sale must be validated before a consignment note can be saved." };
  }

  const accessErr = salesPointErrorForResource(actor, sale.salesPointId);
  if (accessErr) return { ok: false, error: accessErr };
  const submitErr = salesPointErrorForSubmitted(actor, sale.salesPointId);
  if (submitErr) return { ok: false, error: submitErr };

  try {
    if (noteIdRaw) {
      const existing = await prisma.vehicleConsignmentNote.findUnique({
        where: { id: noteIdRaw },
        select: { id: true, saleId: true, status: true },
      });
      if (!existing || existing.saleId !== saleId) {
        return { ok: false, error: "Consignment note not found for this sale." };
      }
      if (existing.status === ValidationStatus.VALIDATED) {
        return { ok: false, error: "Validated consignment notes cannot be edited." };
      }

      const updated = await prisma.vehicleConsignmentNote.update({
        where: { id: existing.id },
        data: {
          destination,
          dateOfLifting,
          vehicleNumber,
          consignerName,
          consignerDesignation,
          dateOfConsignment,
          receiverName,
          receiverNicNo,
          receiverNicPlaceOfIssue,
          receivedDate,
        },
        select: { id: true, consignmentNoteNo: true },
      });
      revalidateConsignmentPaths(updated.id);
      return { ok: true, id: updated.id, consignmentNoteNo: updated.consignmentNoteNo };
    }

    if (sale.consignmentNote) {
      return {
        ok: false,
        error: "This sale already has a consignment note. Load it by VCN number to edit.",
      };
    }

    const consignmentNoteNo = await allocateConsignmentNoteNo(dateOfConsignment);
    const created = await prisma.vehicleConsignmentNote.create({
      data: {
        consignmentNoteNo,
        saleId: sale.id,
        destination,
        dateOfLifting,
        vehicleNumber,
        consignerName,
        consignerDesignation,
        dateOfConsignment,
        receiverName,
        receiverNicNo,
        receiverNicPlaceOfIssue,
        receivedDate,
        status: ValidationStatus.PENDING,
        createdByUserId: session.userId,
      },
      select: { id: true, consignmentNoteNo: true },
    });
    revalidateConsignmentPaths(created.id);
    return { ok: true, id: created.id, consignmentNoteNo: created.consignmentNoteNo };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not save consignment note.";
    return { ok: false, error: msg };
  }
}

export async function deleteConsignmentNote(formData: FormData): Promise<MutationResult> {
  const prisma = getPrismaClient();
  let actor: Awaited<ReturnType<typeof requireActor>>["actor"];
  try {
    await assertPermissionKey("route:/consignment-notes");
    ({ actor } = await requireActor(prisma));
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Login required." };
  }

  if (!canCreateOrEditConsignmentNoteDraft(actor.role)) {
    return { ok: false, error: "Only clerks can delete a pending consignment note." };
  }

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { ok: false, error: "Invalid consignment note." };

  const existing = await prisma.vehicleConsignmentNote.findUnique({
    where: { id },
    include: { sale: { select: { salesPointId: true } } },
  });
  if (!existing) return { ok: false, error: "Consignment note not found." };
  if (existing.status === ValidationStatus.VALIDATED) {
    return { ok: false, error: "Validated consignment notes cannot be deleted." };
  }
  const accessErr = salesPointErrorForResource(actor, existing.sale.salesPointId);
  if (accessErr) return { ok: false, error: accessErr };

  await prisma.vehicleConsignmentNote.delete({ where: { id } });
  revalidatePath("/consignment-notes");
  return { ok: true };
}

export async function validateConsignmentNote(formData: FormData): Promise<MutationResult> {
  const prisma = getPrismaClient();
  let session: Awaited<ReturnType<typeof requireActor>>["session"];
  let actor: Awaited<ReturnType<typeof requireActor>>["actor"];
  try {
    await assertPermissionKey("route:/consignment-notes");
    ({ session, actor } = await requireActor(prisma));
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Login required." };
  }

  if (!canValidateConsignmentNote(actor.role)) {
    return { ok: false, error: "Only supervisors can validate a vehicle consignment note." };
  }

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { ok: false, error: "Invalid consignment note." };

  const existing = await prisma.vehicleConsignmentNote.findUnique({
    where: { id },
    include: { sale: { select: { salesPointId: true } } },
  });
  if (!existing) return { ok: false, error: "Consignment note not found." };
  const accessErr = salesPointErrorForResource(actor, existing.sale.salesPointId);
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
  revalidateConsignmentPaths(id);
  return { ok: true };
}

export type ConsignmentPrintPayload = {
  companyName: string;
  department: string | null;
  companyPhone: string | null;
  companyAddress: string | null;
  logoSrc: string;
  note: ConsignmentNotePrintModel;
};

export async function loadConsignmentPrintById(
  id: string,
): Promise<{ ok: true; data: ConsignmentPrintPayload } | { ok: false; reason: "auth" | "missing" }> {
  const prisma = getPrismaClient();
  let actor: Awaited<ReturnType<typeof requireActor>>["actor"];
  let settings: Awaited<ReturnType<typeof getOrInitCompanySettings>>;
  try {
    await assertPermissionKey("route:/consignment-notes");
    ({ actor } = await requireActor(prisma));
    settings = await getOrInitCompanySettings();
  } catch {
    return { ok: false, reason: "auth" };
  }

  const note = await prisma.vehicleConsignmentNote.findUnique({
    where: { id },
    include: {
      validatedBy: { select: { name: true } },
      sale: {
        include: {
          salesPoint: { select: { name: true } },
          customer: { select: { name: true, address: true } },
          lines: {
            include: { product: { select: { productName: true } } },
            orderBy: { id: "asc" },
          },
        },
      },
    },
  });
  if (!note) return { ok: false, reason: "missing" };

  if (salesPointErrorForResource(actor, note.sale.salesPointId)) {
    return { ok: false, reason: "missing" };
  }

  const doContext = await computeDoContext(prisma, note.sale.deliveryOrderNo);
  const thisLifted = sumSaleLinesQtyKg(note.sale.lines);

  const noteModel: ConsignmentNotePrintModel = {
    consignmentNoteNo: note.consignmentNoteNo,
    status: note.status,
    validatedAtIso: note.validatedAt ? note.validatedAt.toISOString() : null,
    validatedByName: note.validatedBy?.name ?? null,
    invoiceNo: note.sale.invoiceNo,
    fromSalesPointName: note.sale.salesPoint?.name ?? "—",
    destination: note.destination,
    dateOfLiftingIso: note.dateOfLifting.toISOString(),
    vehicleNumber: note.vehicleNumber,
    deliveryOrderNo: note.sale.deliveryOrderNo,
    doContext,
    thisSaleLiftedQtyKg: thisLifted.toFixed(3),
    consignerName: note.consignerName,
    consignerDesignation: note.consignerDesignation,
    dateOfConsignmentIso: note.dateOfConsignment.toISOString(),
    receiverName: note.receiverName,
    receiverNicNo: note.receiverNicNo,
    receiverNicPlaceOfIssue: note.receiverNicPlaceOfIssue,
    receivedDateIso: note.receivedDate ? note.receivedDate.toISOString() : null,
    customerName: note.sale.customer.name,
    lines: note.sale.lines.map((l, i) => ({
      lineNo: i + 1,
      productName: l.product.productName,
      qtyKg: l.qtyKg.toFixed(3),
    })),
  };

  const logoSrc =
    settings.logoUrl && settings.logoUrl.trim() !== ""
      ? settings.logoUrl.trim()
      : "/cdc-logo-svg.svg";

  const deptParts = [
    settings.department?.trim(),
    note.sale.commercialServiceNameSnapshot?.trim(),
  ].filter((s): s is string => Boolean(s && s.length > 0));

  return {
    ok: true,
    data: {
      companyName: settings.companyName,
      department: deptParts.length > 0 ? deptParts.join(" · ") : null,
      companyPhone: note.sale.issuerPhoneSnapshot ?? null,
      companyAddress: note.sale.issuerAddressSnapshot ?? null,
      logoSrc,
      note: noteModel,
    },
  };
}
