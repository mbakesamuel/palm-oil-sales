"use server";

import { assertPermissionKey } from "@/lib/access-control";
import { canValidateBpoDocuments } from "@/lib/auth-roles";
import { getServerSession } from "@/lib/auth-server";
import { salesPointErrorForResource } from "@/lib/auth-sales-point-scope";
import { applyBpoStockDeduction, dQty, ensureBotaSalesPointId, qty3 } from "@/lib/bpo";
import { StockInsufficientError } from "@/lib/stock-ledger";
import { revalidateStockPaths } from "@/lib/stock-revalidate";
import { getPrismaClient } from "@/lib/prisma";
import { prismaRetry } from "@/lib/prisma-retry";
import {
  Prisma,
  StockMovementStatus,
  StockMovementType,
  UserRole,
} from "@prisma/client";

export type StockIssueResult = { ok: true } | { ok: false; error: string };

type LineInput = { productId: string; qtyUnits: string };

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

function parseLines(raw: string) {
  const parsed = JSON.parse(raw || "[]") as LineInput[];
  if (!Array.isArray(parsed) || parsed.length === 0) throw new Error("Add at least one line.");
  return parsed.map((l) => {
    const productId = Number.parseInt(
      String(l.productId ?? (l as { productVariantId?: string }).productVariantId ?? ""),
      10,
    );
    if (!Number.isFinite(productId)) throw new Error("Each line must have a product.");
    const qtyUnits = qty3(dQty(l.qtyUnits));
    if (qtyUnits.lte(0)) throw new Error("Quantity must be greater than zero.");
    return { productId, qtyUnits };
  });
}

async function nextVoucherNo(prisma: ReturnType<typeof getPrismaClient>) {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const prefix = `STK-ISS-${date}`;
  const count = await prisma.stockMovement.count({
    where: { voucherNo: { startsWith: prefix } },
  });
  return `${prefix}-${String(count + 1).padStart(4, "0")}`;
}

export async function createStockIssue(formData: FormData): Promise<StockIssueResult> {
  const prisma = getPrismaClient();
  try {
    await assertPermissionKey("route:/stock/issues");
    const { actor, session } = await requireActor(prisma);
    if (!canValidateBpoDocuments(session.role as UserRole)) {
      return { ok: false, error: "Only authorized supervisors/managers can post stock issues." };
    }
    const hubId = await ensureBotaSalesPointId(prisma);
    const accessErr = salesPointErrorForResource(actor, hubId);
    if (accessErr) return { ok: false, error: accessErr };
    const lines = parseLines(String(formData.get("lines") ?? "[]"));
    const productRows = await prisma.product.findMany({
      where: { productId: { in: lines.map((l) => l.productId) }, form: "BOTTLED" },
      select: { productId: true, productName: true },
    });
    const productById = new Map(productRows.map((p) => [p.productId, p]));
    if (productRows.length !== new Set(lines.map((l) => l.productId)).size) {
      return { ok: false, error: "One or more lines are not bottled products." };
    }
    const reason = String(formData.get("reason") ?? "").trim() || "Gift";
    const note = String(formData.get("note") ?? "").trim() || null;
    const voucherNo = await nextVoucherNo(prisma);
    await prismaRetry(() =>
      prisma.$transaction(
        async (tx) => {
          await applyBpoStockDeduction(
            tx,
            hubId,
            lines.map((l) => {
              const p = productById.get(l.productId)!;
              return {
                productId: l.productId,
                qtyUnits: l.qtyUnits,
                label: p.productName,
              };
            }),
          );
          await tx.stockMovement.create({
            data: {
              movementType: StockMovementType.ISSUE,
              status: StockMovementStatus.VALIDATED,
              voucherNo,
              sourceSalesPointId: hubId,
              movementDate: parseDate(String(formData.get("movementDate") ?? "")),
              reason,
              note,
              createdByUserId: actor.id,
              receiverValidatedByUserId: actor.id,
              receiverValidatedAt: new Date(),
              postedAt: new Date(),
              lines: {
                create: lines.map((l) => ({
                  productId: l.productId,
                  voucherQty: l.qtyUnits,
                  actualQty: l.qtyUnits,
                  postedQty: l.qtyUnits,
                })),
              },
            },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    );
    revalidateStockPaths();
    return { ok: true };
  } catch (e) {
    if (e instanceof StockInsufficientError) return { ok: false, error: e.message };
    return { ok: false, error: e instanceof Error ? e.message : "Could not post issue." };
  }
}
