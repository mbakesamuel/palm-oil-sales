"use server";

import { assertPermissionKey } from "@/lib/access-control";
import { getServerSession } from "@/lib/auth-server";
import {
  salesPointErrorForResource,
  salesPointErrorForSubmitted,
} from "@/lib/auth-sales-point-scope";
import { dQty, getBotaSalesPointId, qty3 } from "@/lib/bpo";
import { getPrismaClient } from "@/lib/prisma";
import { prismaRetry } from "@/lib/prisma-retry";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

export type BpoReceiveResult = { ok: true } | { ok: false; error: string };

async function requireActor(prisma: ReturnType<typeof getPrismaClient>) {
  const session = await getServerSession();
  if (!session?.userId) {
    throw new Error("Login required.");
  }
  const actor = await prismaRetry(() =>
    prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, role: true, salesPointId: true, isActive: true },
    }),
  );
  if (!actor?.isActive) {
    throw new Error("Login required.");
  }
  return { session, actor };
}

function parseReceiptDate(raw: string, fallback?: Date) {
  const s = String(raw ?? "").trim();
  if (!s) return fallback ?? new Date();
  const parsed = new Date(`${s}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? fallback ?? new Date() : parsed;
}

function revalidateBpoStock() {
  revalidatePath("/stock/bpo-receive");
  revalidatePath("/stock/bpo-consignments");
  revalidatePath("/stock/bpo-outbound");
  revalidatePath("/reports/bpo");
}

async function assertNonBotaSalesPoint(
  prisma: ReturnType<typeof getPrismaClient>,
  salesPointId: number | null,
) {
  if (!salesPointId || !Number.isFinite(salesPointId)) {
    return "Select a sales point.";
  }
  const botaId = await getBotaSalesPointId(prisma);
  if (botaId != null && salesPointId === botaId) {
    return "Use BPO consignments to receive stock at Bota. This screen is for non-Bota sales points.";
  }
  return null;
}

export async function receiveBpoStock(formData: FormData): Promise<BpoReceiveResult> {
  const prisma = getPrismaClient();
  let actor: Awaited<ReturnType<typeof requireActor>>["actor"];
  let session: Awaited<ReturnType<typeof requireActor>>["session"];
  try {
    await assertPermissionKey("route:/stock/bpo-receive");
    ({ actor, session } = await requireActor(prisma));
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Login required." };
  }

  const salesPointRaw = String(formData.get("salesPointId") ?? "").trim();
  const salesPointId = session.salesPoint?.id ?? (salesPointRaw ? Number.parseInt(salesPointRaw, 10) : null);
  const spErr = salesPointErrorForSubmitted(actor, salesPointId);
  if (spErr) return { ok: false, error: spErr };
  const botaErr = await assertNonBotaSalesPoint(prisma, salesPointId);
  if (botaErr) return { ok: false, error: botaErr };

  const productVariantId = String(formData.get("productVariantId") ?? "").trim();
  if (!productVariantId) return { ok: false, error: "Select a BPO variant." };

  let qtyUnits: Prisma.Decimal;
  try {
    qtyUnits = qty3(dQty(String(formData.get("qtyUnits") ?? "")));
  } catch {
    return { ok: false, error: "Quantity must be a valid number." };
  }
  if (qtyUnits.lte(0)) return { ok: false, error: "Quantity must be greater than zero." };

  const variant = await prismaRetry(() =>
    prisma.productVariant.findUnique({
      where: { id: productVariantId },
      select: { id: true, product: { select: { isBottledPalmOil: true } } },
    }),
  );
  if (!variant?.product.isBottledPalmOil) {
    return { ok: false, error: "Selected variant is not a Bottled Palm Oil variant." };
  }

  await prismaRetry(() =>
    prisma.bpoStockBatch.create({
      data: {
        salesPointId: salesPointId!,
        productVariantId,
        qtyReceivedUnits: qtyUnits,
        qtyRemainingUnits: qtyUnits,
        receivedAt: parseReceiptDate(String(formData.get("receivedAt") ?? "")),
        note: String(formData.get("note") ?? "").trim() || null,
      },
    }),
  );

  revalidateBpoStock();
  return { ok: true };
}

export async function updateReceivedBpoBatch(formData: FormData): Promise<BpoReceiveResult> {
  const prisma = getPrismaClient();
  let actor: Awaited<ReturnType<typeof requireActor>>["actor"];
  let session: Awaited<ReturnType<typeof requireActor>>["session"];
  try {
    await assertPermissionKey("route:/stock/bpo-receive");
    ({ actor, session } = await requireActor(prisma));
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Login required." };
  }

  const batchId = String(formData.get("batchId") ?? "").trim();
  if (!batchId) return { ok: false, error: "Missing receipt." };

  const batch = await prismaRetry(() =>
    prisma.bpoStockBatch.findUnique({
      where: { id: batchId },
      select: {
        salesPointId: true,
        productVariantId: true,
        qtyReceivedUnits: true,
        qtyRemainingUnits: true,
        receivedAt: true,
        _count: { select: { saleLineAllocations: true } },
      },
    }),
  );
  if (!batch) return { ok: false, error: "Receipt not found." };

  const accessErr = salesPointErrorForResource(actor, batch.salesPointId);
  if (accessErr) return { ok: false, error: accessErr };

  const salesPointRaw = String(formData.get("salesPointId") ?? "").trim();
  const salesPointId = session.salesPoint?.id ?? (salesPointRaw ? Number.parseInt(salesPointRaw, 10) : null);
  const spErr = salesPointErrorForSubmitted(actor, salesPointId);
  if (spErr) return { ok: false, error: spErr };
  if (salesPointId !== batch.salesPointId) {
    return { ok: false, error: "Sales point does not match this BPO receipt." };
  }
  const botaErr = await assertNonBotaSalesPoint(prisma, salesPointId);
  if (botaErr) return { ok: false, error: botaErr };

  const consumed = new Prisma.Decimal(batch.qtyReceivedUnits).sub(batch.qtyRemainingUnits);
  const isConsumed = consumed.gt(0) || batch._count.saleLineAllocations > 0;
  const productVariantId = String(formData.get("productVariantId") ?? "").trim();

  let qtyUnits: Prisma.Decimal;
  try {
    qtyUnits = qty3(dQty(String(formData.get("qtyUnits") ?? "")));
  } catch {
    return { ok: false, error: "Quantity must be a valid number." };
  }
  if (qtyUnits.lte(0)) return { ok: false, error: "Quantity must be greater than zero." };

  if (isConsumed) {
    if (productVariantId !== batch.productVariantId) {
      return {
        ok: false,
        error: "Variant cannot be changed because this receipt has already been consumed.",
      };
    }
    if (!qtyUnits.equals(batch.qtyReceivedUnits)) {
      return {
        ok: false,
        error: "Quantity cannot be changed because this receipt has already been consumed.",
      };
    }
  } else {
    const variant = await prismaRetry(() =>
      prisma.productVariant.findUnique({
        where: { id: productVariantId },
        select: { id: true, product: { select: { isBottledPalmOil: true } } },
      }),
    );
    if (!variant?.product.isBottledPalmOil) {
      return { ok: false, error: "Selected variant is not a Bottled Palm Oil variant." };
    }
  }

  await prismaRetry(() =>
    prisma.bpoStockBatch.update({
      where: { id: batchId },
      data: {
        productVariantId,
        qtyReceivedUnits: qtyUnits,
        qtyRemainingUnits: isConsumed ? batch.qtyRemainingUnits : qtyUnits,
        receivedAt: parseReceiptDate(String(formData.get("receivedAt") ?? ""), batch.receivedAt),
        note: String(formData.get("note") ?? "").trim() || null,
      },
    }),
  );

  revalidateBpoStock();
  return { ok: true };
}

export async function deleteReceivedBpoBatch(formData: FormData): Promise<BpoReceiveResult> {
  const prisma = getPrismaClient();
  let actor: Awaited<ReturnType<typeof requireActor>>["actor"];
  try {
    await assertPermissionKey("route:/stock/bpo-receive");
    ({ actor } = await requireActor(prisma));
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Login required." };
  }

  const batchId = String(formData.get("batchId") ?? "").trim();
  if (!batchId) return { ok: false, error: "Missing receipt." };

  const batch = await prismaRetry(() =>
    prisma.bpoStockBatch.findUnique({
      where: { id: batchId },
      select: {
        salesPointId: true,
        qtyReceivedUnits: true,
        qtyRemainingUnits: true,
        _count: { select: { saleLineAllocations: true } },
      },
    }),
  );
  if (!batch) return { ok: false, error: "Receipt not found." };

  const accessErr = salesPointErrorForResource(actor, batch.salesPointId);
  if (accessErr) return { ok: false, error: accessErr };

  const consumed = new Prisma.Decimal(batch.qtyReceivedUnits).sub(batch.qtyRemainingUnits);
  if (consumed.gt(0) || batch._count.saleLineAllocations > 0) {
    return { ok: false, error: "Cannot delete this receipt because stock has already moved out." };
  }

  await prismaRetry(() => prisma.bpoStockBatch.delete({ where: { id: batchId } }));

  revalidateBpoStock();
  return { ok: true };
}
