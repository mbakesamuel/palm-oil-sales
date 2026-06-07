"use server";

import { getPrismaClient } from "@/lib/prisma";
import { assertPermissionKey } from "@/lib/access-control";
import { getServerSession } from "@/lib/auth-server";
import {
  assertCustomerAccessible,
  assertTaxRegimeForCommercialLine,
  resolveCustomerCommercialServiceId,
} from "@/lib/customer-commercial";
import { assertCustomerTypeUsable } from "@/lib/customer-types/catalog";
import { parseCustomerTaxFieldsFromForm } from "@/lib/customers/parse-tax-fields";
import { resolveServiceScope } from "@/lib/service-scope";
import { CustomerResidency } from "@prisma/client";
import { revalidatePath } from "next/cache";

export async function createCustomer(formData: FormData) {
  await assertPermissionKey("route:/customers");
  const prisma = getPrismaClient();
  const session = await getServerSession();
  if (!session?.userId) throw new Error("Login required.");
  const scope = resolveServiceScope(session);

  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const email = String(formData.get("email") ?? "").trim() || null;
  const address = String(formData.get("address") ?? "").trim() || null;
  const customerTypeId = String(formData.get("customerTypeId") ?? "").trim();
  const residencyRaw = String(formData.get("residency") ?? "LOCAL");

  if (!name) throw new Error("Customer name is required.");
  if (!customerTypeId) throw new Error("Customer type is required.");
  await assertCustomerTypeUsable(customerTypeId);

  const commercialServiceId = resolveCustomerCommercialServiceId(
    scope,
    String(formData.get("commercialServiceId") ?? ""),
  );

  const cs = await prisma.commercialService.findUnique({
    where: { id: commercialServiceId },
    select: { id: true, isActive: true },
  });
  if (!cs) throw new Error("Commercial line not found.");
  if (!cs.isActive) throw new Error("Selected commercial line is inactive.");

  const tax = parseCustomerTaxFieldsFromForm(formData);
  if (tax.taxRegimeId) {
    await assertTaxRegimeForCommercialLine(prisma, tax.taxRegimeId, commercialServiceId);
  }

  const residency =
    residencyRaw in CustomerResidency
      ? (residencyRaw as CustomerResidency)
      : CustomerResidency.LOCAL;

  await prisma.customer.create({
    data: {
      commercialServiceId,
      name,
      phone,
      email,
      address,
      residency,
      hasTaxpayerId: tax.hasTaxpayerId,
      taxpayerId: tax.taxpayerId,
      taxRegimeId: tax.taxRegimeId,
      customerTypeId,
    },
  });

  revalidatePath("/customers");
  revalidatePath("/setup/customer-types");
  revalidatePath("/dashboard");
  revalidatePath("/pos");
  revalidatePath("/delivery-orders");
}

export async function updateCustomer(formData: FormData) {
  await assertPermissionKey("route:/customers");
  const prisma = getPrismaClient();
  const session = await getServerSession();
  if (!session?.userId) throw new Error("Login required.");
  const scope = resolveServiceScope(session);

  const id = String(formData.get("id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const email = String(formData.get("email") ?? "").trim() || null;
  const address = String(formData.get("address") ?? "").trim() || null;
  const customerTypeId = String(formData.get("customerTypeId") ?? "").trim();
  const residencyRaw = String(formData.get("residency") ?? "LOCAL");

  if (!id) throw new Error("Missing customer id.");
  if (!name) throw new Error("Customer name is required.");
  if (!customerTypeId) throw new Error("Customer type is required.");
  await assertCustomerTypeUsable(customerTypeId);

  const existing = await assertCustomerAccessible(prisma, session, scope, id);
  const commercialServiceId = existing.commercialServiceId;

  const tax = parseCustomerTaxFieldsFromForm(formData);
  if (tax.taxRegimeId) {
    await assertTaxRegimeForCommercialLine(prisma, tax.taxRegimeId, commercialServiceId);
  }

  const residency =
    residencyRaw in CustomerResidency
      ? (residencyRaw as CustomerResidency)
      : CustomerResidency.LOCAL;

  await prisma.customer.update({
    where: { id },
    data: {
      name,
      phone,
      email,
      address,
      residency,
      hasTaxpayerId: tax.hasTaxpayerId,
      taxpayerId: tax.taxpayerId,
      taxRegimeId: tax.taxRegimeId,
      customerTypeId,
    },
  });

  revalidatePath("/customers");
  revalidatePath("/setup/customer-types");
  revalidatePath("/dashboard");
  revalidatePath("/pos");
  revalidatePath("/delivery-orders");
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
  const session = await getServerSession();
  if (!session?.userId) throw new Error("Login required.");
  const scope = resolveServiceScope(session);

  const id = String(formData.get("id") ?? "").trim();
  if (!id) throw new Error("Missing customer id.");

  await assertCustomerAccessible(prisma, session, scope, id);

  await prisma.customer.delete({ where: { id } });

  revalidatePath("/customers");
  revalidatePath("/dashboard");
  revalidatePath("/pos");
  revalidatePath("/delivery-orders");
}
