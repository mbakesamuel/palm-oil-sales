"use server";

import { assertPermissionKey } from "@/lib/access-control";
import { BUILTIN_CUSTOMER_TYPE_CODES } from "@/lib/customer-types/catalog";
import { getPrismaClient } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

function parseCode(raw: string) {
  const code = String(raw ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (!code) throw new Error("Code is required.");
  if (!/^[A-Z][A-Z0-9_]*$/.test(code)) {
    throw new Error("Code must start with a letter and use only A–Z, 0–9, and underscores.");
  }
  return code;
}

export async function saveCustomerType(formData: FormData) {
  await assertPermissionKey("route:/setup/customer-types");
  const prisma = getPrismaClient();
  const id = String(formData.get("id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const codeRaw = String(formData.get("code") ?? "").trim();
  const sortOrderRaw = String(formData.get("sortOrder") ?? "0").trim();
  const isActive = formData.getAll("isActive").includes("1");
  const sortOrder = Number.parseInt(sortOrderRaw, 10);

  if (!name) throw new Error("Display name is required.");
  if (!Number.isFinite(sortOrder)) throw new Error("Sort order must be a number.");

  if (id) {
    const existing = await prisma.customerTypeDefinition.findUnique({
      where: { id },
      select: { isSystem: true },
    });
    if (!existing) throw new Error("Customer type not found.");

    const data: {
      name: string;
      sortOrder: number;
      isActive: boolean;
      code?: string;
    } = { name, sortOrder, isActive };

    if (!existing.isSystem) {
      data.code = parseCode(codeRaw);
    }

    await prisma.customerTypeDefinition.update({
      where: { id },
      data,
    });
  } else {
    const code = parseCode(codeRaw);
    if ((BUILTIN_CUSTOMER_TYPE_CODES as readonly string[]).includes(code)) {
      throw new Error(`Code "${code}" is reserved for a built-in customer type.`);
    }
    await prisma.customerTypeDefinition.create({
      data: {
        code,
        name,
        sortOrder,
        isActive,
        isSystem: false,
      },
    });
  }

  revalidatePath("/setup/customer-types");
  revalidatePath("/customers");
  revalidatePath("/setup/product-pricing");
  revalidatePath("/reports/daily-sales-summary");
  revalidatePath("/reports/sales-summary-by-customer");
  revalidatePath("/reports/daily-sales-crosstab");
  revalidatePath("/pos");
}

export async function deleteCustomerType(formData: FormData) {
  await assertPermissionKey("route:/setup/customer-types");
  const prisma = getPrismaClient();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) throw new Error("Missing id.");

  const row = await prisma.customerTypeDefinition.findUnique({
    where: { id },
    select: {
      isSystem: true,
      name: true,
      _count: { select: { customers: true, priceSchedules: true } },
    },
  });
  if (!row) throw new Error("Customer type not found.");
  if (row.isSystem) {
    throw new Error("Built-in customer types cannot be deleted. Deactivate instead.");
  }

  const usage = row._count.customers + row._count.priceSchedules;
  if (usage > 0) {
    throw new Error(
      `${row.name} is used on ${usage} record(s). Deactivate instead of deleting.`,
    );
  }

  await prisma.customerTypeDefinition.delete({ where: { id } });

  revalidatePath("/setup/customer-types");
  revalidatePath("/customers");
  revalidatePath("/setup/product-pricing");
}
