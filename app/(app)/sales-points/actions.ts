"use server";

import { assertPermissionKey } from "@/lib/access-control";
import { getPrismaClient } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function createSalesPoint(formData: FormData) {
  await assertPermissionKey("route:/sales-points");
  const prisma = getPrismaClient();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Name is required.");

  await prisma.salesPoint.create({ data: { name } });
  revalidatePath("/sales-points");
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
}
