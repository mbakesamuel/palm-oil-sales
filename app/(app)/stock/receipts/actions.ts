"use server";

import { assertPermissionKey } from "@/lib/access-control";
import { getPrismaClient } from "@/lib/prisma";
import { prismaRetry } from "@/lib/prisma-retry";
import { getServerSession } from "@/lib/auth-server";
import {
  salesPointErrorForResource,
  salesPointErrorForSubmitted,
} from "@/lib/auth-sales-point-scope";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { roleMayMutateBpoReceiveRows } from "@/lib/auth-roles";
import { dQty, getBotaSalesPointId, qty3 } from "@/lib/bpo";
import { revalidateStockPaths } from "@/lib/stock-revalidate";

export type ReceiptStockResult = { ok: true } | { ok: false; error: string };

/** @deprecated */
export type ReceiveStockResult = ReceiptStockResult;

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

function parseDecimalQty(raw: string): Prisma.Decimal | null {
  const s = String(raw ?? "").trim().replace(",", ".");
  if (!s) return null;
  try {
    const x = new Prisma.Decimal(s);
    return x;
  } catch {
    return null;
  }
}

export async function receiveStock(formData: FormData): Promise<ReceiptStockResult> {
  const prisma = getPrismaClient();

  let actor: Awaited<ReturnType<typeof requireActor>>["actor"];
  try {
    await assertPermissionKey("route:/stock/receipts");
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

  const qtyKg = parseDecimalQty(String(formData.get("qtyKg") ?? ""));
  if (!qtyKg || qtyKg.lte(0)) {
    return { ok: false, error: "Quantity (kg) must be greater than zero." };
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
    prisma.stockLot.create({
      data: {
        salesPointId: salesPointId!,
        storageLocationId: storageLocation.id,
        productId,
        uom: "KG",
        qtyReceived: qtyKg,
        qtyRemaining: qtyKg,
        receivedAt,
        note,
      },
    }),
  );

  revalidatePath("/stock/receipts");
  revalidatePath("/reports/stock-on-hand");
  revalidatePath("/reports/stock-vs-commitments");
  revalidatePath("/storage-locations");
  return { ok: true };
}

export async function updateReceivedBatch(formData: FormData): Promise<ReceiptStockResult> {
  const prisma = getPrismaClient();

  let actor: Awaited<ReturnType<typeof requireActor>>["actor"];
  try {
    await assertPermissionKey("route:/stock/receipts");
    ({ actor } = await requireActor(prisma));
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Login required." };
  }

  const batchId = String(formData.get("batchId") ?? "").trim();
  if (!batchId) return { ok: false, error: "Missing batch." };

  const batch = await prismaRetry(() =>
    prisma.stockLot.findUnique({
      where: { id: batchId },
      select: {
        salesPointId: true,
        storageLocationId: true,
        productId: true,
        qtyReceived: true,
        qtyRemaining: true,
        receivedAt: true,
        _count: { select: { allocations: true } },
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

  const qtyKg = parseDecimalQty(String(formData.get("qtyKg") ?? ""));
  if (!qtyKg || qtyKg.lte(0)) {
    return { ok: false, error: "Quantity (kg) must be greater than zero." };
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

  const hasAlloc = batch._count.allocations > 0;
  if (hasAlloc) {
    if (productId !== batch.productId) {
      return {
        ok: false,
        error: "Product cannot be changed — validated sales already use this receipt.",
      };
    }
    if (!qtyKg.equals(batch.qtyReceived)) {
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
    qtyRemaining = new Prisma.Decimal(batch.qtyRemaining);
  }

  await prismaRetry(() =>
    prisma.stockLot.update({
      where: { id: batchId },
      data: {
        storageLocationId: storageLocation.id,
        productId,
        qtyReceived: qtyKg,
        qtyRemaining: qtyRemaining,
        receivedAt,
        note,
      },
    }),
  );

  revalidatePath("/stock/receipts");
  revalidatePath("/reports/stock-on-hand");
  revalidatePath("/reports/stock-vs-commitments");
  revalidatePath("/storage-locations");
  return { ok: true };
}

export async function deleteReceivedBatch(formData: FormData): Promise<ReceiptStockResult> {
  const prisma = getPrismaClient();

  let actor: Awaited<ReturnType<typeof requireActor>>["actor"];
  try {
    await assertPermissionKey("route:/stock/receipts");
    ({ actor } = await requireActor(prisma));
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Login required." };
  }

  const batchId = String(formData.get("batchId") ?? "").trim();
  if (!batchId) return { ok: false, error: "Missing batch." };

  const batch = await prismaRetry(() =>
    prisma.stockLot.findUnique({
      where: { id: batchId },
      select: {
        salesPointId: true,
        _count: { select: { allocations: true } },
      },
    }),
  );
  if (!batch) return { ok: false, error: "Receipt not found." };

  const resErr = salesPointErrorForResource(actor, batch.salesPointId);
  if (resErr) return { ok: false, error: resErr };

  if (batch._count.allocations > 0) {
    return {
      ok: false,
      error: "Cannot delete — validated sales reference this receipt.",
    };
  }

  await prismaRetry(() => prisma.stockLot.delete({ where: { id: batchId } }));

  revalidatePath("/stock/receipts");
  revalidatePath("/reports/stock-on-hand");
  revalidatePath("/reports/stock-vs-commitments");
  revalidatePath("/storage-locations");
  return { ok: true };
}

function parseReceiptDate(raw: string, fallback?: Date) {
  const s = String(raw ?? "").trim();
  if (!s) return fallback ?? new Date();
  const parsed = new Date(`${s}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? fallback ?? new Date() : parsed;
}

async function floorStorageLocationId(
  prisma: ReturnType<typeof getPrismaClient>,
  salesPointId: number,
) {
  const loc = await prisma.storageLocation.findFirst({
    where: { salesPointId, name: "Floor" },
    select: { id: true },
  });
  return loc?.id ?? null;
}

async function assertNonHubSalesPoint(
  prisma: ReturnType<typeof getPrismaClient>,
  salesPointId: number | null,
) {
  if (!salesPointId || !Number.isFinite(salesPointId)) {
    return "Select a sales point.";
  }
  const hubId = await getBotaSalesPointId(prisma);
  if (hubId != null && salesPointId === hubId) {
    return "Use Transfers to receive stock at the hub. Direct receipts are for other sales points.";
  }
  return null;
}

export async function receiveBottledStock(formData: FormData): Promise<ReceiptStockResult> {
  const prisma = getPrismaClient();
  let actor: Awaited<ReturnType<typeof requireActor>>["actor"];
  let session: Awaited<ReturnType<typeof requireActor>>["session"];
  try {
    await assertPermissionKey("route:/stock/receipts");
    ({ actor, session } = await requireActor(prisma));
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Login required." };
  }

  const salesPointRaw = String(formData.get("salesPointId") ?? "").trim();
  const salesPointId =
    session.salesPoint?.id ?? (salesPointRaw ? Number.parseInt(salesPointRaw, 10) : null);
  const spErr = salesPointErrorForSubmitted(actor, salesPointId);
  if (spErr) return { ok: false, error: spErr };
  const hubErr = await assertNonHubSalesPoint(prisma, salesPointId);
  if (hubErr) return { ok: false, error: hubErr };

  const productId = Number.parseInt(String(formData.get("productId") ?? formData.get("productVariantId") ?? ""), 10);
  if (!Number.isFinite(productId)) return { ok: false, error: "Select a bottled product." };

  const qtyRaw = dQty(String(formData.get("qtyUnits") ?? ""));
  let qtyUnits: Prisma.Decimal;
  try {
    qtyUnits = qty3(qtyRaw);
  } catch {
    return { ok: false, error: "Quantity must be a valid number." };
  }
  if (qtyUnits.lte(0)) return { ok: false, error: "Quantity must be greater than zero." };

  const product = await prismaRetry(() =>
    prisma.product.findUnique({
      where: { productId },
      select: { productId: true, form: true },
    }),
  );
  if (product?.form !== "BOTTLED") {
    return { ok: false, error: "Selected product is not a bottled SKU." };
  }

  const storageLocationId = await floorStorageLocationId(prisma, salesPointId!);
  if (storageLocationId == null) {
    return { ok: false, error: "No floor storage location for this sales point." };
  }

  await prismaRetry(() =>
    prisma.stockLot.create({
      data: {
        salesPointId: salesPointId!,
        storageLocationId,
        productId,
        uom: "UNIT",
        qtyReceived: qtyUnits,
        qtyRemaining: qtyUnits,
        receivedAt: parseReceiptDate(String(formData.get("receivedAt") ?? "")),
        note: String(formData.get("note") ?? "").trim() || null,
      },
    }),
  );

  revalidateStockPaths();
  return { ok: true };
}

export async function updateReceivedBottledBatch(formData: FormData): Promise<ReceiptStockResult> {
  const prisma = getPrismaClient();
  let actor: Awaited<ReturnType<typeof requireActor>>["actor"];
  let session: Awaited<ReturnType<typeof requireActor>>["session"];
  try {
    await assertPermissionKey("route:/stock/receipts");
    ({ actor, session } = await requireActor(prisma));
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Login required." };
  }

  if (!roleMayMutateBpoReceiveRows(actor.role)) {
    return { ok: false, error: "Only sales point staff can edit a bottled receipt." };
  }

  const batchId = String(formData.get("batchId") ?? "").trim();
  if (!batchId) return { ok: false, error: "Missing receipt." };

  const batch = await prismaRetry(() =>
    prisma.stockLot.findUnique({
      where: { id: batchId },
      select: {
        salesPointId: true,
        productId: true,
        qtyReceived: true,
        qtyRemaining: true,
        receivedAt: true,
        _count: { select: { allocations: true } },
      },
    }),
  );
  if (!batch) return { ok: false, error: "Receipt not found." };

  const accessErr = salesPointErrorForResource(actor, batch.salesPointId);
  if (accessErr) return { ok: false, error: accessErr };

  const salesPointRaw = String(formData.get("salesPointId") ?? "").trim();
  const salesPointId =
    session.salesPoint?.id ?? (salesPointRaw ? Number.parseInt(salesPointRaw, 10) : null);
  const spErr = salesPointErrorForSubmitted(actor, salesPointId);
  if (spErr) return { ok: false, error: spErr };
  if (salesPointId !== batch.salesPointId) {
    return { ok: false, error: "Sales point does not match this receipt." };
  }
  const hubErr = await assertNonHubSalesPoint(prisma, salesPointId);
  if (hubErr) return { ok: false, error: hubErr };

  const consumed = new Prisma.Decimal(batch.qtyReceived).sub(batch.qtyRemaining);
  const isConsumed = consumed.gt(0) || batch._count.allocations > 0;
  const productId = Number.parseInt(
    String(formData.get("productId") ?? formData.get("productVariantId") ?? ""),
    10,
  );

  let qtyUnits: Prisma.Decimal;
  try {
    qtyUnits = qty3(dQty(String(formData.get("qtyUnits") ?? "")));
  } catch {
    return { ok: false, error: "Quantity must be a valid number." };
  }
  if (qtyUnits.lte(0)) return { ok: false, error: "Quantity must be greater than zero." };

  if (isConsumed) {
    if (productId !== batch.productId) {
      return {
        ok: false,
        error: "Product cannot be changed because this receipt has already been consumed.",
      };
    }
    if (!qtyUnits.equals(batch.qtyReceived)) {
      return {
        ok: false,
        error: "Quantity cannot be changed because this receipt has already been consumed.",
      };
    }
  } else {
    const product = await prismaRetry(() =>
      prisma.product.findUnique({
        where: { productId },
        select: { form: true },
      }),
    );
    if (product?.form !== "BOTTLED") {
      return { ok: false, error: "Selected product is not a bottled SKU." };
    }
  }

  await prismaRetry(() =>
    prisma.stockLot.update({
      where: { id: batchId },
      data: {
        productId,
        qtyReceived: qtyUnits,
        qtyRemaining: isConsumed ? batch.qtyRemaining : qtyUnits,
        receivedAt: parseReceiptDate(String(formData.get("receivedAt") ?? ""), batch.receivedAt),
        note: String(formData.get("note") ?? "").trim() || null,
      },
    }),
  );

  revalidateStockPaths();
  return { ok: true };
}

export async function deleteReceivedBottledBatch(formData: FormData): Promise<ReceiptStockResult> {
  const prisma = getPrismaClient();
  let actor: Awaited<ReturnType<typeof requireActor>>["actor"];
  try {
    await assertPermissionKey("route:/stock/receipts");
    ({ actor } = await requireActor(prisma));
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Login required." };
  }

  const batchId = String(formData.get("batchId") ?? "").trim();
  if (!batchId) return { ok: false, error: "Missing receipt." };

  const batch = await prismaRetry(() =>
    prisma.stockLot.findUnique({
      where: { id: batchId },
      select: {
        salesPointId: true,
        qtyReceived: true,
        qtyRemaining: true,
        _count: { select: { allocations: true } },
      },
    }),
  );
  if (!batch) return { ok: false, error: "Receipt not found." };

  const accessErr = salesPointErrorForResource(actor, batch.salesPointId);
  if (accessErr) return { ok: false, error: accessErr };

  const consumed = new Prisma.Decimal(batch.qtyReceived).sub(batch.qtyRemaining);
  if (consumed.gt(0) || batch._count.allocations > 0) {
    return { ok: false, error: "Cannot delete this receipt because stock has already moved out." };
  }

  await prismaRetry(() => prisma.stockLot.delete({ where: { id: batchId } }));

  revalidateStockPaths();
  return { ok: true };
}
