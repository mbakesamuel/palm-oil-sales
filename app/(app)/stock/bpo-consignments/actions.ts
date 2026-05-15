"use server";

import { assertPermissionKey } from "@/lib/access-control";
import { canValidateBpoDocuments, roleMayRaiseBpoConsignmentSenderVoucher } from "@/lib/auth-roles";
import { getServerSession } from "@/lib/auth-server";
import {
  salesPointErrorForResource,
  salesPointErrorForSubmitted,
} from "@/lib/auth-sales-point-scope";
import {
  BpoStockInsufficientError,
  applyBpoStockDeduction,
  dQty,
  ensureBotaSalesPointId,
  qty3,
} from "@/lib/bpo";
import { getPrismaClient } from "@/lib/prisma";
import { prismaRetry } from "@/lib/prisma-retry";
import { BpoMovementStatus, BpoMovementType, Prisma, UserRole, ValidationStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import type { UserRole as AppUserRole } from "@/lib/domain";

export type BpoMutationResult =
  | { ok: true; id?: string; voucherNo?: string }
  | { ok: false; error: string };

export type BpoConsignmentPrintPayload = {
  id: string;
  voucherNo: string;
  status: BpoMovementStatus;
  movementDateIso: string;
  sourceSalesPointName: string;
  destinationSalesPointName: string;
  note: string | null;
  discrepancyNote: string | null;
  createdByName: string;
  senderValidatedByName: string | null;
  botaValidatedByName: string | null;
  senderValidatedAtIso: string | null;
  botaValidatedAtIso: string | null;
  postedAtIso: string | null;
  lines: Array<{
    id: string;
    variantLabel: string;
    voucherQtyUnits: string;
    actualQtyUnits: string | null;
    postedQtyUnits: string | null;
  }>;
};

export type BpoPrintResult =
  | { ok: true; data: BpoConsignmentPrintPayload }
  | { ok: false; error: string };

type VoucherLineInput = { productVariantId: string; qtyUnits: string; actualQtyUnits?: string };

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
  const count = await prisma.bpoStockMovement.count({
    where: { voucherNo: { startsWith: prefix } },
  });
  return `${prefix}-${String(count + 1).padStart(4, "0")}`;
}

function parseLines(raw: string): Array<{ productVariantId: string; qtyUnits: Prisma.Decimal; actualQtyUnits?: Prisma.Decimal }> {
  const parsed = JSON.parse(raw || "[]") as VoucherLineInput[];
  if (!Array.isArray(parsed) || parsed.length === 0) throw new Error("Add at least one variant line.");
  return parsed.map((l) => {
    const productVariantId = String(l.productVariantId ?? "").trim();
    if (!productVariantId) throw new Error("Each line must have a variant.");
    const qtyUnits = qty3(dQty(l.qtyUnits));
    if (qtyUnits.lte(0)) throw new Error("Quantity must be greater than zero.");
    const actualRaw = String(l.actualQtyUnits ?? "").trim();
    const actualQtyUnits = actualRaw ? qty3(dQty(actualRaw)) : undefined;
    if (actualQtyUnits && actualQtyUnits.lt(0)) throw new Error("Actual quantity cannot be negative.");
    return { productVariantId, qtyUnits, actualQtyUnits };
  });
}

async function availableBpoUnitsByVariant(
  prisma: ReturnType<typeof getPrismaClient> | Prisma.TransactionClient,
  salesPointId: number,
  variantIds: string[],
  asOfDate: Date,
  excludeMovementId?: string,
) {
  const uniqueVariantIds = [...new Set(variantIds)];
  const asOfEnd = endOfUtcDate(asOfDate);
  const [directReceipts, validatedMovements, saleLines, openMovements] = await Promise.all([
    prisma.bpoStockBatch.findMany({
      where: {
        salesPointId,
        productVariantId: { in: uniqueVariantIds },
        sourceMovementLineId: null,
        receivedAt: { lte: asOfEnd },
      },
      select: { productVariantId: true, qtyReceivedUnits: true },
    }),
    prisma.bpoStockMovement.findMany({
      where: {
        status: BpoMovementStatus.VALIDATED,
        movementDate: { lte: asOfEnd },
        OR: [{ sourceSalesPointId: salesPointId }, { destinationSalesPointId: salesPointId }],
        movementType: {
          in: [
            BpoMovementType.CONSIGNMENT_TRANSFER,
            BpoMovementType.GIFT,
            BpoMovementType.OTHER_OUT,
          ],
        },
      },
      select: {
        movementType: true,
        sourceSalesPointId: true,
        destinationSalesPointId: true,
        lines: {
          where: { productVariantId: { in: uniqueVariantIds } },
          select: {
            productVariantId: true,
            postedQtyUnits: true,
            actualQtyUnits: true,
            voucherQtyUnits: true,
          },
        },
      },
    }),
    prisma.saleLine.findMany({
      where: {
        productVariantId: { in: uniqueVariantIds },
        product: { isBottledPalmOil: true },
        sale: {
          salesPointId,
          status: ValidationStatus.VALIDATED,
          soldAt: { lte: asOfEnd },
        },
      },
      select: { productVariantId: true, qtyUnits: true },
    }),
    prisma.bpoStockMovement.findMany({
      where: {
        sourceSalesPointId: salesPointId,
        status: { in: [BpoMovementStatus.DRAFT, BpoMovementStatus.SENDER_VALIDATED] },
        movementDate: { lte: asOfEnd },
        ...(excludeMovementId ? { id: { not: excludeMovementId } } : {}),
      },
      select: {
        lines: {
          where: { productVariantId: { in: uniqueVariantIds } },
          select: { productVariantId: true, voucherQtyUnits: true },
        },
      },
    }),
  ]);

  const ledger = new Map<string, Prisma.Decimal>();
  for (const receipt of directReceipts) {
    ledger.set(
      receipt.productVariantId,
      (ledger.get(receipt.productVariantId) ?? new Prisma.Decimal(0)).add(receipt.qtyReceivedUnits),
    );
  }
  for (const movement of validatedMovements) {
    for (const line of movement.lines) {
      const qty = line.postedQtyUnits ?? line.actualQtyUnits ?? line.voucherQtyUnits;
      const current = ledger.get(line.productVariantId) ?? new Prisma.Decimal(0);
      if (movement.movementType === BpoMovementType.CONSIGNMENT_TRANSFER) {
        if (movement.sourceSalesPointId === salesPointId) {
          ledger.set(line.productVariantId, current.sub(qty));
        } else if (movement.destinationSalesPointId === salesPointId) {
          ledger.set(line.productVariantId, current.add(qty));
        }
      } else if (movement.sourceSalesPointId === salesPointId) {
        ledger.set(line.productVariantId, current.sub(qty));
      }
    }
  }
  for (const saleLine of saleLines) {
    if (!saleLine.productVariantId || !saleLine.qtyUnits) continue;
    ledger.set(
      saleLine.productVariantId,
      (ledger.get(saleLine.productVariantId) ?? new Prisma.Decimal(0)).sub(saleLine.qtyUnits),
    );
  }
  const reserved = new Map<string, Prisma.Decimal>();
  for (const movement of openMovements) {
    for (const line of movement.lines) {
      reserved.set(
        line.productVariantId,
        (reserved.get(line.productVariantId) ?? new Prisma.Decimal(0)).add(line.voucherQtyUnits),
      );
    }
  }

  const available = new Map<string, Prisma.Decimal>();
  for (const variantId of uniqueVariantIds) {
    const qty = (ledger.get(variantId) ?? new Prisma.Decimal(0)).sub(
      reserved.get(variantId) ?? new Prisma.Decimal(0),
    );
    available.set(variantId, qty.gt(0) ? qty : new Prisma.Decimal(0));
  }
  return available;
}

async function assertBpoAvailability(
  prisma: ReturnType<typeof getPrismaClient> | Prisma.TransactionClient,
  salesPointId: number,
  lines: Array<{ productVariantId: string; qtyUnits: Prisma.Decimal }>,
  movementDate: Date,
  excludeMovementId?: string,
) {
  const requested = new Map<string, Prisma.Decimal>();
  for (const line of lines) {
    requested.set(
      line.productVariantId,
      (requested.get(line.productVariantId) ?? new Prisma.Decimal(0)).add(line.qtyUnits),
    );
  }
  const labels = await prisma.productVariant.findMany({
    where: { id: { in: [...requested.keys()] } },
    select: { id: true, name: true, product: { select: { productName: true } } },
  });
  const labelById = new Map(labels.map((v) => [v.id, `${v.product.productName} - ${v.name}`]));
  const available = await availableBpoUnitsByVariant(
    prisma,
    salesPointId,
    [...requested.keys()],
    movementDate,
    excludeMovementId,
  );

  for (const [variantId, qty] of requested) {
    const avail = available.get(variantId) ?? new Prisma.Decimal(0);
    if (qty.gt(avail)) {
      return `Insufficient available BPO stock for ${labelById.get(variantId) ?? "selected variant"} at source sales point as at ${movementDate.toISOString().slice(0, 10)}. Requested ${qty.toDecimalPlaces(3).toString()} units; available ${avail.toDecimalPlaces(3).toString()} units.`;
    }
  }
  return null;
}

function revalidateBpo() {
  revalidatePath("/stock/bpo-consignments");
  revalidatePath("/reports/bpo");
  revalidatePath("/reports/stock-on-hand");
  revalidatePath("/pos");
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
): BpoConsignmentPrintPayload {
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
    botaValidatedByName: movement.botaValidatedBy?.name ?? null,
    senderValidatedAtIso: movement.senderValidatedAt?.toISOString() ?? null,
    botaValidatedAtIso: movement.botaValidatedAt?.toISOString() ?? null,
    postedAtIso: movement.postedAt?.toISOString() ?? null,
    lines: movement.lines.map((line) => ({
      id: line.id,
      variantLabel: `${line.productVariant.product.productName} - ${line.productVariant.name}`,
      voucherQtyUnits: line.voucherQtyUnits.toString(),
      actualQtyUnits: line.actualQtyUnits?.toString() ?? null,
      postedQtyUnits: line.postedQtyUnits?.toString() ?? null,
    })),
  };
}

function loadBpoPrintMovement(prisma: ReturnType<typeof getPrismaClient>, id: string) {
  return prisma.bpoStockMovement.findUnique({
    where: { id },
    include: {
      sourceSalesPoint: { select: { name: true } },
      destinationSalesPoint: { select: { name: true } },
      createdBy: { select: { name: true } },
      senderValidatedBy: { select: { name: true } },
      botaValidatedBy: { select: { name: true } },
      lines: {
        include: {
          productVariant: {
            select: { name: true, product: { select: { productName: true } } },
          },
        },
        orderBy: { id: "asc" },
      },
    },
  });
}

export async function createBpoConsignmentVoucher(formData: FormData): Promise<BpoMutationResult> {
  const prisma = getPrismaClient();
  let session: Awaited<ReturnType<typeof requireActor>>["session"];
  let actor: Awaited<ReturnType<typeof requireActor>>["actor"];
  try {
    await assertPermissionKey("route:/stock/bpo-consignments");
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
    const variantCount = await prisma.productVariant.count({
      where: {
        id: { in: lines.map((l) => l.productVariantId) },
        product: { isBottledPalmOil: true },
      },
    });
    if (variantCount !== new Set(lines.map((l) => l.productVariantId)).size) {
      return { ok: false, error: "One or more lines are not Bottled Palm Oil variants." };
    }
    const movementDate = parseDate(String(formData.get("movementDate") ?? ""));
    const availabilityErr = await assertBpoAvailability(prisma, sourceSalesPointId, lines, movementDate);
    if (availabilityErr) return { ok: false, error: availabilityErr };
    const voucherNo = await nextVoucherNo(prisma);
    const movement = await prisma.bpoStockMovement.create({
      data: {
        movementType: BpoMovementType.CONSIGNMENT_TRANSFER,
        status: BpoMovementStatus.DRAFT,
        voucherNo,
        sourceSalesPointId,
        destinationSalesPointId: botaId,
        movementDate,
        note: String(formData.get("note") ?? "").trim() || null,
        createdByUserId: actor.id,
        lines: {
          create: lines.map((l) => ({
            productVariantId: l.productVariantId,
            voucherQtyUnits: l.qtyUnits,
          })),
        },
      },
    });
    revalidateBpo();
    return { ok: true, id: movement.id, voucherNo: movement.voucherNo };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not create voucher." };
  }
}

export async function senderValidateBpoConsignment(formData: FormData): Promise<BpoMutationResult> {
  const prisma = getPrismaClient();
  try {
    await assertPermissionKey("route:/stock/bpo-consignments");
    const { actor, session } = await requireActor(prisma);
    if (!canValidateBpoDocuments(session.role as UserRole)) {
      return { ok: false, error: "Only authorized supervisors/managers can validate vouchers." };
    }
    const id = String(formData.get("id") ?? "").trim();
    const row = await prisma.bpoStockMovement.findUnique({
      where: { id },
      select: {
        status: true,
        sourceSalesPointId: true,
        movementType: true,
        movementDate: true,
        lines: { select: { productVariantId: true, voucherQtyUnits: true } },
      },
    });
    if (!row || row.movementType !== BpoMovementType.CONSIGNMENT_TRANSFER) return { ok: false, error: "Voucher not found." };
    const accessErr = salesPointErrorForResource(actor, row.sourceSalesPointId);
    if (accessErr) return { ok: false, error: accessErr };
    if (row.status !== BpoMovementStatus.DRAFT) return { ok: false, error: "Only draft vouchers can be sender-validated." };
    if (!row.sourceSalesPointId) return { ok: false, error: "Voucher has no source sales point." };
    const availabilityErr = await assertBpoAvailability(
      prisma,
      row.sourceSalesPointId,
      row.lines.map((l) => ({
        productVariantId: l.productVariantId,
        qtyUnits: l.voucherQtyUnits,
      })),
      row.movementDate,
      id,
    );
    if (availabilityErr) return { ok: false, error: availabilityErr };
    await prisma.bpoStockMovement.update({
      where: { id },
      data: {
        status: BpoMovementStatus.SENDER_VALIDATED,
        senderValidatedByUserId: actor.id,
        senderValidatedAt: new Date(),
      },
    });
    revalidateBpo();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not validate voucher." };
  }
}

export async function botaValidateBpoConsignment(formData: FormData): Promise<BpoMutationResult> {
  const prisma = getPrismaClient();
  try {
    await assertPermissionKey("route:/stock/bpo-consignments");
    const { actor, session } = await requireActor(prisma);
    if (!canValidateBotaConsignment(session.role as UserRole)) {
      return { ok: false, error: "Only senior supervisors and managers can validate Bota receipt." };
    }
    const botaId = await ensureBotaSalesPointId(prisma);
    const botaAccessErr = salesPointErrorForResource(actor, botaId);
    if (botaAccessErr) return { ok: false, error: botaAccessErr };
    const id = String(formData.get("id") ?? "").trim();
    const actuals = parseLines(String(formData.get("lines") ?? "[]"));
    const actualByVariant = new Map(actuals.map((l) => [l.productVariantId, l.actualQtyUnits ?? l.qtyUnits]));
    const validated = await prismaRetry(() =>
      prisma.$transaction(
        async (tx) => {
          const movement = await tx.bpoStockMovement.findUnique({
            where: { id },
            include: {
              lines: {
                include: {
                  productVariant: {
                    select: { id: true, name: true, product: { select: { productName: true } } },
                  },
                },
              },
            },
          });
          if (!movement || movement.movementType !== BpoMovementType.CONSIGNMENT_TRANSFER) {
            throw new Error("Voucher not found.");
          }
          if (movement.status !== BpoMovementStatus.SENDER_VALIDATED) {
            throw new Error("Bota can only validate sender-validated vouchers.");
          }
          if (!movement.sourceSalesPointId || movement.destinationSalesPointId !== botaId) {
            throw new Error("Invalid Bota transfer document.");
          }

          const stockLines = movement.lines.map((line) => {
            const actual = actualByVariant.get(line.productVariantId);
            if (!actual) throw new Error(`Enter actual received quantity for ${line.productVariant.name}.`);
            return {
              line,
              qty: qty3(actual),
              label: `${line.productVariant.product.productName} - ${line.productVariant.name}`,
            };
          });
          await applyBpoStockDeduction(
            tx,
            movement.sourceSalesPointId,
            stockLines
              .filter((l) => l.qty.gt(0))
              .map((l) => ({
                productVariantId: l.line.productVariantId,
                qtyUnits: l.qty,
                label: l.label,
              })),
          );
          for (const l of stockLines) {
            await tx.bpoStockMovementLine.update({
              where: { id: l.line.id },
              data: {
                actualQtyUnits: l.qty,
                postedQtyUnits: l.qty,
              },
            });
            if (l.qty.gt(0)) {
              await tx.bpoStockBatch.create({
                data: {
                  salesPointId: botaId,
                  productVariantId: l.line.productVariantId,
                  qtyReceivedUnits: l.qty,
                  qtyRemainingUnits: l.qty,
                  receivedAt: new Date(),
                  sourceMovementLineId: l.line.id,
                  note: `Received from ${movement.voucherNo}`,
                },
              });
            }
          }
          const updated = await tx.bpoStockMovement.update({
            where: { id },
            data: {
              status: BpoMovementStatus.VALIDATED,
              botaValidatedByUserId: actor.id,
              botaValidatedAt: new Date(),
              postedAt: new Date(),
              discrepancyNote: String(formData.get("discrepancyNote") ?? "").trim() || null,
            },
            select: { id: true, voucherNo: true },
          });
          return updated;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    );
    revalidateBpo();
    return { ok: true, id: validated.id, voucherNo: validated.voucherNo };
  } catch (e) {
    if (e instanceof BpoStockInsufficientError) return { ok: false, error: e.message };
    return { ok: false, error: e instanceof Error ? e.message : "Could not validate Bota receipt." };
  }
}

export async function loadBpoConsignmentVoucherPrint(id: string): Promise<BpoPrintResult> {
  const prisma = getPrismaClient();
  try {
    await assertPermissionKey("route:/stock/bpo-consignments");
    const { actor } = await requireActor(prisma);
    const movement = await loadBpoPrintMovement(prisma, id.trim());
    if (!movement || movement.movementType !== BpoMovementType.CONSIGNMENT_TRANSFER) {
      return { ok: false, error: "Voucher not found." };
    }
    const accessErr = salesPointErrorForResource(actor, movement.sourceSalesPointId);
    if (accessErr) return { ok: false, error: accessErr };
    return { ok: true, data: mapBpoPrintPayload(movement) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not load voucher print." };
  }
}

export async function loadBpoConsignmentReceiptVoucherPrint(id: string): Promise<BpoPrintResult> {
  const prisma = getPrismaClient();
  try {
    await assertPermissionKey("route:/stock/bpo-consignments");
    const { actor } = await requireActor(prisma);
    const botaId = await ensureBotaSalesPointId(prisma);
    const movement = await loadBpoPrintMovement(prisma, id.trim());
    if (!movement || movement.movementType !== BpoMovementType.CONSIGNMENT_TRANSFER) {
      return { ok: false, error: "Voucher not found." };
    }
    if (movement.status !== BpoMovementStatus.SENDER_VALIDATED || movement.destinationSalesPointId !== botaId) {
      return { ok: false, error: "Receipt voucher is only available for sender-validated Bota transfers." };
    }
    const accessErr = salesPointErrorForResource(actor, botaId);
    if (accessErr) return { ok: false, error: accessErr };
    return { ok: true, data: mapBpoPrintPayload(movement) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not load receipt voucher print." };
  }
}

export async function loadBpoConsignmentConfirmationPrint(id: string): Promise<BpoPrintResult> {
  const prisma = getPrismaClient();
  try {
    await assertPermissionKey("route:/stock/bpo-consignments");
    const { actor } = await requireActor(prisma);
    const botaId = await ensureBotaSalesPointId(prisma);
    const movement = await loadBpoPrintMovement(prisma, id.trim());
    if (!movement || movement.movementType !== BpoMovementType.CONSIGNMENT_TRANSFER) {
      return { ok: false, error: "Voucher not found." };
    }
    if (movement.status !== BpoMovementStatus.VALIDATED || movement.destinationSalesPointId !== botaId) {
      return { ok: false, error: "Confirmation receipt is only available for validated Bota transfers." };
    }
    const accessErr = salesPointErrorForResource(actor, botaId);
    if (accessErr) return { ok: false, error: accessErr };
    return { ok: true, data: mapBpoPrintPayload(movement) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not load confirmation print." };
  }
}

export async function rejectBpoConsignment(formData: FormData): Promise<BpoMutationResult> {
  const prisma = getPrismaClient();
  try {
    await assertPermissionKey("route:/stock/bpo-consignments");
    const { actor, session } = await requireActor(prisma);
    if (!canValidateBpoDocuments(session.role as UserRole)) return { ok: false, error: "Only authorized users can reject vouchers." };
    const id = String(formData.get("id") ?? "").trim();
    const reason = String(formData.get("reason") ?? "").trim();
    const movement = await prisma.bpoStockMovement.findUnique({
      where: { id },
      select: { sourceSalesPointId: true, destinationSalesPointId: true, status: true },
    });
    if (!movement) return { ok: false, error: "Voucher not found." };
    const sourceErr = salesPointErrorForResource(actor, movement.sourceSalesPointId);
    const destErr = salesPointErrorForResource(actor, movement.destinationSalesPointId);
    if (sourceErr && destErr) return { ok: false, error: sourceErr };
    if (movement.status === BpoMovementStatus.VALIDATED) return { ok: false, error: "Posted vouchers cannot be rejected." };
    await prisma.bpoStockMovement.update({
      where: { id },
      data: {
        status: BpoMovementStatus.REJECTED,
        rejectedAt: new Date(),
        rejectedReason: reason || null,
      },
    });
    revalidateBpo();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not reject voucher." };
  }
}
