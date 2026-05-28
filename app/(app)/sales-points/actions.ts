"use server";

import { assertPermissionKey } from "@/lib/access-control";
import { getPrismaClient } from "@/lib/prisma";
import { ensureDefaultStorageLocation } from "@/lib/stock/storage-location";
import { revalidatePath } from "next/cache";

export async function createSalesPoint(formData: FormData) {
  await assertPermissionKey("route:/sales-points");
  const prisma = getPrismaClient();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Name is required.");

  await prisma.$transaction(async (tx) => {
    const sp = await tx.salesPoint.create({ data: { name }, select: { id: true } });
    await ensureDefaultStorageLocation(tx, sp.id);
  });
  revalidatePath("/sales-points");
  revalidatePath("/stock");
}

export async function updateSalesPoint(formData: FormData) {
  await assertPermissionKey("route:/sales-points");
  const prisma = getPrismaClient();
  const idRaw = String(formData.get("id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const id = Number.parseInt(idRaw, 10);
  if (!Number.isFinite(id)) throw new Error("Invalid sales point.");
  if (!name) throw new Error("Name is required.");

  await prisma.salesPoint.update({
    where: { id },
    data: { name },
  });
  revalidatePath("/sales-points");
}

export async function saveSalesPoint(formData: FormData) {
  await assertPermissionKey("route:/sales-points");
  const idRaw = String(formData.get("id") ?? "").trim();
  if (idRaw) return updateSalesPoint(formData);
  return createSalesPoint(formData);
}

export async function deleteSalesPoint(formData: FormData) {
  await assertPermissionKey("route:/sales-points");
  const prisma = getPrismaClient();
  const idRaw = String(formData.get("id") ?? "").trim();
  const id = Number.parseInt(idRaw, 10);
  if (!Number.isFinite(id)) throw new Error("Invalid sales point.");

  await prisma.salesPoint.delete({ where: { id } });
  revalidatePath("/sales-points");
  revalidatePath("/stock");
}

export async function saveStorageLocation(formData: FormData) {
  await assertPermissionKey("route:/sales-points");
  const prisma = getPrismaClient();
  const idRaw = String(formData.get("id") ?? "").trim();
  const salesPointIdRaw = String(formData.get("salesPointId") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const salesPointId = Number.parseInt(salesPointIdRaw, 10);
  if (!Number.isFinite(salesPointId)) throw new Error("Invalid sales point.");
  if (!name) throw new Error("Location name is required.");

  if (idRaw) {
    const id = Number.parseInt(idRaw, 10);
    if (!Number.isFinite(id)) throw new Error("Invalid storage location.");
    await prisma.storageLocation.update({
      where: { id },
      data: { name },
    });
  } else {
    await prisma.storageLocation.create({
      data: { salesPointId, name, isSellable: true },
    });
  }

  revalidatePath("/sales-points");
  revalidatePath("/stock");
}

export async function deleteStorageLocation(formData: FormData) {
  await assertPermissionKey("route:/sales-points");
  const prisma = getPrismaClient();
  const idRaw = String(formData.get("id") ?? "").trim();
  const id = Number.parseInt(idRaw, 10);
  if (!Number.isFinite(id)) throw new Error("Invalid storage location.");

  const loc = await prisma.storageLocation.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      isDefault: true,
      _count: {
        select: {
          stockBalances: true,
          stockMovements: true,
          stockReceiptLines: true,
          stockAdjustmentLines: true,
          stockTransferLinesFrom: true,
          stockTransferLinesTo: true,
        },
      },
    },
  });
  if (!loc) throw new Error("Storage location not found.");
  if (loc.isDefault) {
    throw new Error("Cannot delete the default storage location. Set another location as default first.");
  }

  const refs =
    loc._count.stockReceiptLines +
    loc._count.stockAdjustmentLines +
    loc._count.stockTransferLinesFrom +
    loc._count.stockTransferLinesTo +
    loc._count.stockMovements;

  const nonZeroBalance = await prisma.stockBalance.findFirst({
    where: { storageLocationId: id, qty: { gt: 0 } },
    select: { productId: true },
  });
  if (nonZeroBalance || refs > 0) {
    throw new Error(
      `Cannot delete "${loc.name}" — it has stock history or a non-zero balance.`,
    );
  }

  await prisma.storageLocation.delete({ where: { id } });
  revalidatePath("/sales-points");
  revalidatePath("/stock");
}

export async function setDefaultStorageLocation(formData: FormData) {
  await assertPermissionKey("route:/sales-points");
  const prisma = getPrismaClient();
  const idRaw = String(formData.get("id") ?? "").trim();
  const id = Number.parseInt(idRaw, 10);
  if (!Number.isFinite(id)) throw new Error("Invalid storage location.");

  const loc = await prisma.storageLocation.findUnique({
    where: { id },
    select: { salesPointId: true },
  });
  if (!loc) throw new Error("Storage location not found.");

  await prisma.$transaction([
    prisma.storageLocation.updateMany({
      where: { salesPointId: loc.salesPointId, isDefault: true },
      data: { isDefault: false },
    }),
    prisma.storageLocation.update({
      where: { id },
      data: { isDefault: true },
    }),
  ]);

  revalidatePath("/sales-points");
  revalidatePath("/stock");
}
