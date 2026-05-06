"use server";

import { getPrismaClient } from "@/lib/prisma";
import { assertPermissionKey } from "@/lib/access-control";
import { CustomerResidency, CustomerType } from "@prisma/client";
import { revalidatePath } from "next/cache";

export async function createCustomer(formData: FormData) {
  await assertPermissionKey("route:/customers");
  const prisma = getPrismaClient();
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const email = String(formData.get("email") ?? "").trim() || null;
  const address = String(formData.get("address") ?? "").trim() || null;
  const hasTaxpayerId = String(formData.get("hasTaxpayerId") ?? "") === "on";
  const taxpayerIdRaw = String(formData.get("taxpayerId") ?? "").trim() || null;
  const taxRegimeId = String(formData.get("taxRegime") ?? "").trim();
  const customerTypeRaw = String(formData.get("customerType") ?? "INDUSTRY");
  const residencyRaw = String(formData.get("residency") ?? "LOCAL");

  if (!name) throw new Error("Customer name is required.");
  if (!taxRegimeId) throw new Error("Tax regime is required.");

  const customerType =
    customerTypeRaw in CustomerType
      ? (customerTypeRaw as CustomerType)
      : CustomerType.INDUSTRY;

  const residency =
    residencyRaw in CustomerResidency
      ? (residencyRaw as CustomerResidency)
      : CustomerResidency.LOCAL;

  const taxpayerId = hasTaxpayerId ? taxpayerIdRaw : null;
  const hasTaxpayerIdFinal = Boolean(taxpayerId);

  await prisma.customer.create({
    data: {
      name,
      phone,
      email,
      address,
      residency,
      hasTaxpayerId: hasTaxpayerIdFinal,
      taxpayerId,
      taxRegimeId,
      customerType,
    },
  });

  revalidatePath("/customers");
  revalidatePath("/dashboard");
}

export async function updateCustomer(formData: FormData) {
  await assertPermissionKey("route:/customers");
  const prisma = getPrismaClient();
  const id = String(formData.get("id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const email = String(formData.get("email") ?? "").trim() || null;
  const address = String(formData.get("address") ?? "").trim() || null;
  const hasTaxpayerId = String(formData.get("hasTaxpayerId") ?? "") === "on";
  const taxpayerIdRaw = String(formData.get("taxpayerId") ?? "").trim() || null;
  const taxRegimeId = String(formData.get("taxRegimeId") ?? "").trim();
  const customerTypeRaw = String(formData.get("customerType") ?? "INDUSTRY");
  const residencyRaw = String(formData.get("residency") ?? "LOCAL");

  if (!id) throw new Error("Missing customer id.");
  if (!name) throw new Error("Customer name is required.");
  if (!taxRegimeId) throw new Error("Tax regime is required.");

  const customerType =
    customerTypeRaw in CustomerType
      ? (customerTypeRaw as CustomerType)
      : CustomerType.INDUSTRY;

  const residency =
    residencyRaw in CustomerResidency
      ? (residencyRaw as CustomerResidency)
      : CustomerResidency.LOCAL;

  const taxpayerId = hasTaxpayerId ? taxpayerIdRaw : null;
  const hasTaxpayerIdFinal = Boolean(taxpayerId);

  await prisma.customer.update({
    where: { id },
    data: {
      name,
      phone,
      email,
      address,
      residency,
      hasTaxpayerId: hasTaxpayerIdFinal,
      taxpayerId,
      taxRegimeId,
      customerType,
    },
  });

  revalidatePath("/customers");
  revalidatePath("/dashboard");
}

export async function saveCustomer(formData: FormData) {
  await assertPermissionKey("route:/customers");
  const id = String(formData.get("id") ?? "").trim();
  if (id) return updateCustomer(formData);
  return createCustomer(formData);
}

export async function deleteCustomer(formData: FormData) {
  await assertPermissionKey("route:/customers");
  const prisma = getPrismaClient();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) throw new Error("Missing customer id.");

  await prisma.customer.delete({ where: { id } });

  revalidatePath("/customers");
  revalidatePath("/dashboard");
}

