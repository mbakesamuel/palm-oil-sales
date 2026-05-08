"use server";

import { assertPermissionKey } from "@/lib/access-control";
import { canValidateBpoDocuments } from "@/lib/auth-roles";
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
import { BpoMovementStatus, BpoMovementType, Prisma, UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";

export type BpoMutationResult = { ok: true } | { ok: false; error: string };

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
  excludeMovementId?: string,
) {
  const uniqueVariantIds = [...new Set(variantIds)];
  const [batches, openMovements] = await Promise.all([
    prisma.bpoStockBatch.findMany({
      where: {
        salesPointId,
        productVariantId: { in: uniqueVariantIds },
        qtyRemainingUnits: { gt: 0 },
      },
      select: { productVariantId: true, qtyRemainingUnits: true },
    }),
    prisma.bpoStockMovement.findMany({
      where: {
        sourceSalesPointId: salesPointId,
        status: { in: [BpoMovementStatus.DRAFT, BpoMovementStatus.SENDER_VALIDATED] },
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

  const physical = new Map<string, Prisma.Decimal>();
  for (const b of batches) {
    physical.set(
      b.productVariantId,
      (physical.get(b.productVariantId) ?? new Prisma.Decimal(0)).add(b.qtyRemainingUnits),
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
    const qty = (physical.get(variantId) ?? new Prisma.Decimal(0)).sub(
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
    excludeMovementId,
  );

  for (const [variantId, qty] of requested) {
    const avail = available.get(variantId) ?? new Prisma.Decimal(0);
    if (qty.gt(avail)) {
      return `Insufficient available BPO stock for ${labelById.get(variantId) ?? "selected variant"} at source sales point. Requested ${qty.toDecimalPlaces(3).toString()} units; available ${avail.toDecimalPlaces(3).toString()} units.`;
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

export async function createBpoConsignmentVoucher(formData: FormData): Promise<BpoMutationResult> {
  const prisma = getPrismaClient();
  let session: Awaited<ReturnType<typeof requireActor>>["session"];
  let actor: Awaited<ReturnType<typeof requireActor>>["actor"];
  try {
    await assertPermissionKey("route:/stock/bpo-consignments");
    ({ session, actor } = await requireActor(prisma));
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
    const availabilityErr = await assertBpoAvailability(prisma, sourceSalesPointId, lines);
    if (availabilityErr) return { ok: false, error: availabilityErr };
    const voucherNo = await nextVoucherNo(prisma);
    await prisma.bpoStockMovement.create({
      data: {
        movementType: BpoMovementType.CONSIGNMENT_TRANSFER,
        status: BpoMovementStatus.DRAFT,
        voucherNo,
        sourceSalesPointId,
        destinationSalesPointId: botaId,
        movementDate: parseDate(String(formData.get("movementDate") ?? "")),
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
    return { ok: true };
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
    if (!canValidateBpoDocuments(session.role as UserRole)) {
      return { ok: false, error: "Only authorized supervisors/managers can validate Bota receipt." };
    }
    const botaId = await ensureBotaSalesPointId(prisma);
    const botaAccessErr = salesPointErrorForResource(actor, botaId);
    if (botaAccessErr) return { ok: false, error: botaAccessErr };
    const id = String(formData.get("id") ?? "").trim();
    const actuals = parseLines(String(formData.get("lines") ?? "[]"));
    const actualByVariant = new Map(actuals.map((l) => [l.productVariantId, l.actualQtyUnits ?? l.qtyUnits]));
    await prismaRetry(() =>
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
          await tx.bpoStockMovement.update({
            where: { id },
            data: {
              status: BpoMovementStatus.VALIDATED,
              botaValidatedByUserId: actor.id,
              botaValidatedAt: new Date(),
              postedAt: new Date(),
              discrepancyNote: String(formData.get("discrepancyNote") ?? "").trim() || null,
            },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    );
    revalidateBpo();
    return { ok: true };
  } catch (e) {
    if (e instanceof BpoStockInsufficientError) return { ok: false, error: e.message };
    return { ok: false, error: e instanceof Error ? e.message : "Could not validate Bota receipt." };
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
