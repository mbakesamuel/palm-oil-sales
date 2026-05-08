"use server";

import { assertPermissionKey } from "@/lib/access-control";
import { canValidateBpoDocuments } from "@/lib/auth-roles";
import { getServerSession } from "@/lib/auth-server";
import { salesPointErrorForResource } from "@/lib/auth-sales-point-scope";
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

export type BpoOutboundResult = { ok: true } | { ok: false; error: string };

type LineInput = { productVariantId: string; qtyUnits: string };

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

async function nextVoucherNo(prisma: ReturnType<typeof getPrismaClient>) {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const prefix = `BPO-OUT-${date}`;
  const count = await prisma.bpoStockMovement.count({
    where: { voucherNo: { startsWith: prefix } },
  });
  return `${prefix}-${String(count + 1).padStart(4, "0")}`;
}

function parseLines(raw: string) {
  const parsed = JSON.parse(raw || "[]") as LineInput[];
  if (!Array.isArray(parsed) || parsed.length === 0) throw new Error("Add at least one line.");
  return parsed.map((l) => {
    const productVariantId = String(l.productVariantId ?? "").trim();
    const qtyUnits = qty3(dQty(l.qtyUnits));
    if (!productVariantId) throw new Error("Each line must have a variant.");
    if (qtyUnits.lte(0)) throw new Error("Quantity must be greater than zero.");
    return { productVariantId, qtyUnits };
  });
}

function parseDate(raw: string): Date {
  const s = String(raw ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(`${s}T00:00:00.000Z`);
  return new Date();
}

function revalidateBpo() {
  revalidatePath("/stock/bpo-outbound");
  revalidatePath("/reports/bpo");
  revalidatePath("/pos");
}

export async function createBpoOutboundMovement(formData: FormData): Promise<BpoOutboundResult> {
  const prisma = getPrismaClient();
  try {
    await assertPermissionKey("route:/stock/bpo-outbound");
    const { actor, session } = await requireActor(prisma);
    if (!canValidateBpoDocuments(session.role as UserRole)) {
      return { ok: false, error: "Only authorized supervisors/managers can post BPO outbound movements." };
    }
    const botaId = await ensureBotaSalesPointId(prisma);
    const accessErr = salesPointErrorForResource(actor, botaId);
    if (accessErr) return { ok: false, error: accessErr };
    const lines = parseLines(String(formData.get("lines") ?? "[]"));
    const variantRows = await prisma.productVariant.findMany({
      where: { id: { in: lines.map((l) => l.productVariantId) }, product: { isBottledPalmOil: true } },
      select: { id: true, name: true, product: { select: { productName: true } } },
    });
    const variantById = new Map(variantRows.map((v) => [v.id, v]));
    if (variantRows.length !== new Set(lines.map((l) => l.productVariantId)).size) {
      return { ok: false, error: "One or more lines are not Bottled Palm Oil variants." };
    }
    const reason = String(formData.get("reason") ?? "").trim() || "Gift";
    const note = String(formData.get("note") ?? "").trim() || null;
    const voucherNo = await nextVoucherNo(prisma);
    await prismaRetry(() =>
      prisma.$transaction(
        async (tx) => {
          await applyBpoStockDeduction(
            tx,
            botaId,
            lines.map((l) => {
              const v = variantById.get(l.productVariantId)!;
              return {
                productVariantId: l.productVariantId,
                qtyUnits: l.qtyUnits,
                label: `${v.product.productName} - ${v.name}`,
              };
            }),
          );
          await tx.bpoStockMovement.create({
            data: {
              movementType: reason.toLowerCase() === "gift" ? BpoMovementType.GIFT : BpoMovementType.OTHER_OUT,
              status: BpoMovementStatus.VALIDATED,
              voucherNo,
              sourceSalesPointId: botaId,
              movementDate: parseDate(String(formData.get("movementDate") ?? "")),
              reason,
              note,
              createdByUserId: actor.id,
              botaValidatedByUserId: actor.id,
              botaValidatedAt: new Date(),
              postedAt: new Date(),
              lines: {
                create: lines.map((l) => ({
                  productVariantId: l.productVariantId,
                  voucherQtyUnits: l.qtyUnits,
                  actualQtyUnits: l.qtyUnits,
                  postedQtyUnits: l.qtyUnits,
                })),
              },
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
    return { ok: false, error: e instanceof Error ? e.message : "Could not post outbound movement." };
  }
}
