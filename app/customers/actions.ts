"use server";

import { getPrismaClient } from "@/lib/prisma";
import { CustomerType } from "@prisma/client";
import { revalidatePath } from "next/cache";

export async function createCustomer(formData: FormData) {
  const prisma = getPrismaClient();
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const email = String(formData.get("email") ?? "").trim() || null;
  const address = String(formData.get("address") ?? "").trim() || null;
  const taxpayerId = String(formData.get("taxpayerId") ?? "").trim() || null;
  const taxRegimeId = String(formData.get("taxRegime") ?? "").trim();
  const customerTypeRaw = String(formData.get("customerType") ?? "INDUSTRY");

  if (!name) throw new Error("Customer name is required.");
  if (!taxRegimeId) throw new Error("Tax regime is required.");

  const customerType =
    customerTypeRaw in CustomerType
      ? (customerTypeRaw as CustomerType)
      : CustomerType.INDUSTRY;

  await prisma.customer.create({
    data: { name, phone, email, address, taxpayerId, taxRegimeId, customerType },
  });

  revalidatePath("/customers");
}

