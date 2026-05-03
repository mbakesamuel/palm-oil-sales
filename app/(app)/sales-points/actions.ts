"use server";

import { getPrismaClient } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function createSalesPoint(formData: FormData) {
  const prisma = getPrismaClient();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Name is required.");

  const sp = await prisma.salesPoint.create({ data: { name }, select: { id: true } });
  await prisma.storageLocation.createMany({
    data: [
      { salesPointId: sp.id, name: "Production tank 1" },
      { salesPointId: sp.id, name: "Production tank 2" },
    ],
  });
  revalidatePath("/sales-points");
  revalidatePath("/storage-locations");
  revalidatePath("/stock/receive");
}

export async function updateSalesPoint(formData: FormData) {
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
  const idRaw = String(formData.get("id") ?? "").trim();
  if (idRaw) return updateSalesPoint(formData);
  return createSalesPoint(formData);
}

export async function deleteSalesPoint(formData: FormData) {
  const prisma = getPrismaClient();
  const idRaw = String(formData.get("id") ?? "").trim();
  const id = Number.parseInt(idRaw, 10);
  if (!Number.isFinite(id)) throw new Error("Invalid sales point.");

  await prisma.salesPoint.delete({ where: { id } });
  revalidatePath("/sales-points");
  revalidatePath("/storage-locations");
  revalidatePath("/stock/receive");
  revalidatePath("/reports/stock-on-hand");
}

