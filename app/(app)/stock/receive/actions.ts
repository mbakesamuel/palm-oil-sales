"use server";

import { getPrismaClient } from "@/lib/prisma";
import { prismaRetry } from "@/lib/prisma-retry";
import { getServerSession } from "@/lib/auth-server";
import {
  salesPointErrorForResource,
  salesPointErrorForSubmitted,
} from "@/lib/auth-sales-point-scope";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

export type ReceiveStockResult = { ok: true } | { ok: false; error: string };

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

function dQty(raw: string): Prisma.Decimal | null {
  const s = String(raw ?? "").trim().replace(",", ".");
  if (!s) return null;
  try {
    const x = new Prisma.Decimal(s);
    return x;
  } catch {
    return null;
  }
}

export async function receiveStock(formData: FormData): Promise<ReceiveStockResult> {
  const prisma = getPrismaClient();

  let actor: Awaited<ReturnType<typeof requireActor>>["actor"];
  try {
    ({ actor } = await requireActor(prisma));
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Login required." };
  }

  const salesPointRaw = String(formData.get("salesPointId") ?? "").trim();
  const salesPointId = salesPointRaw ? Number.parseInt(salesPointRaw, 10) : null;
  const spErr = salesPointErrorForSubmitted(actor, salesPointId);
  if (spErr) return { ok: false, error: spErr };

  const storageLocationRaw = String(formData.get("storageLocationId") ?? "").trim();
  const storageLocationId = storageLocationRaw ? Number.parseInt(storageLocationRaw, 10) : null;
  if (!Number.isFinite(storageLocationId)) {
    return { ok: false, error: "Select a storage location." };
  }

  const productId = Number.parseInt(String(formData.get("productId") ?? ""), 10);
  if (!Number.isFinite(productId)) {
    return { ok: false, error: "Select a product." };
  }

  const qtyKg = dQty(String(formData.get("qtyKg") ?? ""));
  if (!qtyKg || qtyKg.lte(0)) {
    return { ok: false, error: "Quantity (kg) must be greater than zero." };
  }

  const costPerKg = dQty(String(formData.get("costPerKg") ?? ""));
  if (!costPerKg || costPerKg.lt(0)) {
    return { ok: false, error: "Cost per kg must be zero or greater." };
  }

  const note = String(formData.get("note") ?? "").trim() || null;
  const receivedAtRaw = String(formData.get("receivedAt") ?? "").trim();
  let receivedAt = new Date();
  if (receivedAtRaw) {
    const parsed = new Date(`${receivedAtRaw}T12:00:00`);
    if (!Number.isNaN(parsed.getTime())) {
      receivedAt = parsed;
    }
  }

  const [product, storageLocation] = await Promise.all([
    prismaRetry(() =>
      prisma.product.findUnique({
        where: { productId },
        select: { productId: true },
      }),
    ),
    prismaRetry(() =>
      prisma.storageLocation.findUnique({
        where: { id: storageLocationId! },
        select: { id: true, salesPointId: true },
      }),
    ),
  ]);
  if (!product) return { ok: false, error: "Product not found." };
  if (!storageLocation || storageLocation.salesPointId !== salesPointId) {
    return { ok: false, error: "Storage location does not belong to this sales point." };
  }

  await prismaRetry(() =>
    prisma.batch.create({
      data: {
        salesPointId: salesPointId!,
        storageLocationId: storageLocation.id,
        productId,
        qtyReceivedKg: qtyKg,
        qtyRemainingKg: qtyKg,
        costPerKg,
        receivedAt,
        note,
      },
    }),
  );

  revalidatePath("/stock/receive");
  revalidatePath("/reports/stock-on-hand");
  revalidatePath("/storage-locations");
  return { ok: true };
}

export async function updateReceivedBatch(formData: FormData): Promise<ReceiveStockResult> {
  const prisma = getPrismaClient();

  let actor: Awaited<ReturnType<typeof requireActor>>["actor"];
  try {
    ({ actor } = await requireActor(prisma));
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Login required." };
  }

  const batchId = String(formData.get("batchId") ?? "").trim();
  if (!batchId) return { ok: false, error: "Missing batch." };

  const batch = await prismaRetry(() =>
    prisma.batch.findUnique({
      where: { id: batchId },
      select: {
        salesPointId: true,
        storageLocationId: true,
        productId: true,
        qtyReceivedKg: true,
        qtyRemainingKg: true,
        receivedAt: true,
        _count: { select: { saleLineAllocations: true } },
      },
    }),
  );
  if (!batch) return { ok: false, error: "Receipt not found." };

  const resErr = salesPointErrorForResource(actor, batch.salesPointId);
  if (resErr) return { ok: false, error: resErr };

  const salesPointRaw = String(formData.get("salesPointId") ?? "").trim();
  const salesPointId = salesPointRaw ? Number.parseInt(salesPointRaw, 10) : null;
  const spSubErr = salesPointErrorForSubmitted(actor, salesPointId);
  if (spSubErr) return { ok: false, error: spSubErr };
  if (salesPointId !== batch.salesPointId) {
    return { ok: false, error: "Sales point does not match this receipt." };
  }

  const storageLocationRaw = String(formData.get("storageLocationId") ?? "").trim();
  const storageLocationId = storageLocationRaw ? Number.parseInt(storageLocationRaw, 10) : null;
  if (!Number.isFinite(storageLocationId)) {
    return { ok: false, error: "Select a storage location." };
  }

  const productId = Number.parseInt(String(formData.get("productId") ?? ""), 10);
  if (!Number.isFinite(productId)) {
    return { ok: false, error: "Select a product." };
  }

  const qtyKg = dQty(String(formData.get("qtyKg") ?? ""));
  if (!qtyKg || qtyKg.lte(0)) {
    return { ok: false, error: "Quantity (kg) must be greater than zero." };
  }

  const costPerKg = dQty(String(formData.get("costPerKg") ?? ""));
  if (!costPerKg || costPerKg.lt(0)) {
    return { ok: false, error: "Cost per kg must be zero or greater." };
  }

  const note = String(formData.get("note") ?? "").trim() || null;
  const receivedAtRaw = String(formData.get("receivedAt") ?? "").trim();
  let receivedAt = batch.receivedAt;
  if (receivedAtRaw) {
    const parsed = new Date(`${receivedAtRaw}T12:00:00`);
    if (!Number.isNaN(parsed.getTime())) {
      receivedAt = parsed;
    }
  }

  const hasAlloc = batch._count.saleLineAllocations > 0;
  if (hasAlloc) {
    if (productId !== batch.productId) {
      return {
        ok: false,
        error: "Product cannot be changed — validated sales already use this receipt.",
      };
    }
    if (!qtyKg.equals(batch.qtyReceivedKg)) {
      return {
        ok: false,
        error: "Quantity cannot be changed — stock from this receipt was already sold.",
      };
    }
  }

  const storageLocation = await prismaRetry(() =>
    prisma.storageLocation.findUnique({
      where: { id: storageLocationId! },
      select: { id: true, salesPointId: true },
    }),
  );
  if (!storageLocation || storageLocation.salesPointId !== batch.salesPointId) {
    return { ok: false, error: "Storage location does not belong to this sales point." };
  }

  const product = await prismaRetry(() =>
    prisma.product.findUnique({ where: { productId }, select: { productId: true } }),
  );
  if (!product) return { ok: false, error: "Product not found." };

  let qtyRemaining = qtyKg;
  if (hasAlloc) {
    qtyRemaining = new Prisma.Decimal(batch.qtyRemainingKg);
  }

  await prismaRetry(() =>
    prisma.batch.update({
      where: { id: batchId },
      data: {
        storageLocationId: storageLocation.id,
        productId,
        qtyReceivedKg: qtyKg,
        qtyRemainingKg: qtyRemaining,
        costPerKg,
        receivedAt,
        note,
      },
    }),
  );

  revalidatePath("/stock/receive");
  revalidatePath("/reports/stock-on-hand");
  revalidatePath("/storage-locations");
  return { ok: true };
}

export async function deleteReceivedBatch(formData: FormData): Promise<ReceiveStockResult> {
  const prisma = getPrismaClient();

  let actor: Awaited<ReturnType<typeof requireActor>>["actor"];
  try {
    ({ actor } = await requireActor(prisma));
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Login required." };
  }

  const batchId = String(formData.get("batchId") ?? "").trim();
  if (!batchId) return { ok: false, error: "Missing batch." };

  const batch = await prismaRetry(() =>
    prisma.batch.findUnique({
      where: { id: batchId },
      select: {
        salesPointId: true,
        _count: { select: { saleLineAllocations: true } },
      },
    }),
  );
  if (!batch) return { ok: false, error: "Receipt not found." };

  const resErr = salesPointErrorForResource(actor, batch.salesPointId);
  if (resErr) return { ok: false, error: resErr };

  if (batch._count.saleLineAllocations > 0) {
    return {
      ok: false,
      error: "Cannot delete — validated sales reference this receipt.",
    };
  }

  await prismaRetry(() => prisma.batch.delete({ where: { id: batchId } }));

  revalidatePath("/stock/receive");
  revalidatePath("/reports/stock-on-hand");
  revalidatePath("/storage-locations");
  return { ok: true };
}
