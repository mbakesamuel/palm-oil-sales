"use server";

import { assertPermissionKey } from "@/lib/access-control";
import { BUILTIN_PAYMENT_METHOD_CODES } from "@/lib/payment-methods/catalog";
import type { PaymentMethodKind } from "@/lib/payment-methods/types";
import { getPrismaClient } from "@/lib/prisma";
import { PaymentMethodKind as PrismaPaymentMethodKind } from "@prisma/client";
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

function parseKind(raw: string): PrismaPaymentMethodKind {
  const kind = String(raw ?? "").trim().toUpperCase();
  if (kind === "SIMPLE" || kind === "CHEQUE" || kind === "TRAITE") {
    return kind;
  }
  throw new Error("Kind must be Simple, Cheque, or Traite.");
}

export async function savePaymentMethod(formData: FormData) {
  await assertPermissionKey("route:/setup/payment-methods");
  const prisma = getPrismaClient();
  const id = String(formData.get("id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const codeRaw = String(formData.get("code") ?? "").trim();
  const kindRaw = String(formData.get("kind") ?? "SIMPLE").trim();
  const sortOrderRaw = String(formData.get("sortOrder") ?? "0").trim();
  const isActive = formData.getAll("isActive").includes("1");
  const sortOrder = Number.parseInt(sortOrderRaw, 10);

  if (!name) throw new Error("Display name is required.");
  if (!Number.isFinite(sortOrder)) throw new Error("Sort order must be a number.");

  if (id) {
    const existing = await prisma.paymentMethodDefinition.findUnique({
      where: { id },
      select: { isSystem: true, code: true },
    });
    if (!existing) throw new Error("Payment method not found.");

    const data: {
      name: string;
      sortOrder: number;
      isActive: boolean;
      code?: string;
      kind?: PrismaPaymentMethodKind;
    } = { name, sortOrder, isActive };

    if (!existing.isSystem) {
      data.code = parseCode(codeRaw);
      data.kind = parseKind(kindRaw);
    }

    await prisma.paymentMethodDefinition.update({
      where: { id },
      data,
    });
  } else {
    const code = parseCode(codeRaw);
    if ((BUILTIN_PAYMENT_METHOD_CODES as readonly string[]).includes(code)) {
      throw new Error(`Code "${code}" is reserved for a built-in payment method.`);
    }
    await prisma.paymentMethodDefinition.create({
      data: {
        code,
        name,
        kind: parseKind(kindRaw),
        sortOrder,
        isActive,
        isSystem: false,
      },
    });
  }

  revalidatePath("/setup/payment-methods");
  revalidatePath("/pos");
  revalidatePath("/delivery-orders");
}

export async function deletePaymentMethod(formData: FormData) {
  await assertPermissionKey("route:/setup/payment-methods");
  const prisma = getPrismaClient();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) throw new Error("Missing id.");

  const row = await prisma.paymentMethodDefinition.findUnique({
    where: { id },
    select: {
      isSystem: true,
      name: true,
      _count: { select: { payments: true, deliveryOrderPayments: true } },
    },
  });
  if (!row) throw new Error("Payment method not found.");
  if (row.isSystem) {
    throw new Error("Built-in payment methods cannot be deleted. Deactivate instead.");
  }

  const usage = row._count.payments + row._count.deliveryOrderPayments;
  if (usage > 0) {
    throw new Error(
      `${row.name} is used on ${usage} transaction(s). Deactivate instead of deleting.`,
    );
  }

  await prisma.paymentMethodDefinition.delete({ where: { id } });

  revalidatePath("/setup/payment-methods");
  revalidatePath("/pos");
  revalidatePath("/delivery-orders");
}
