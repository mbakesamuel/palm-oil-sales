import { getPrismaClient } from "@/lib/prisma";
import type { CustomerTypeOption } from "@/lib/customer-types/types";

export const BUILTIN_CUSTOMER_TYPE_CODES = [
  "INDUSTRY",
  "WHOLE_SALE",
  "RETAIL",
  "WORKER",
] as const;

export type BuiltinCustomerTypeCode = (typeof BUILTIN_CUSTOMER_TYPE_CODES)[number];

const BUILTIN_SEED: Array<{
  id: string;
  code: BuiltinCustomerTypeCode;
  name: string;
  sortOrder: number;
}> = [
  { id: "ct_industry", code: "INDUSTRY", name: "Industry", sortOrder: 10 },
  { id: "ct_whole_sale", code: "WHOLE_SALE", name: "Whole sale", sortOrder: 20 },
  { id: "ct_retail", code: "RETAIL", name: "Retail", sortOrder: 30 },
  { id: "ct_worker", code: "WORKER", name: "Worker", sortOrder: 40 },
];

export function toCustomerTypeOption(row: {
  id: string;
  code: string;
  name: string;
}): CustomerTypeOption {
  return { id: row.id, code: row.code, name: row.name };
}

export async function ensureBuiltinCustomerTypes() {
  const prisma = getPrismaClient();
  for (const row of BUILTIN_SEED) {
    await prisma.customerTypeDefinition.upsert({
      where: { code: row.code },
      create: {
        id: row.id,
        code: row.code,
        name: row.name,
        sortOrder: row.sortOrder,
        isActive: true,
        isSystem: true,
      },
      update: {
        name: row.name,
        sortOrder: row.sortOrder,
        isSystem: true,
      },
    });
  }
}

export async function listCustomerTypeDefinitions(opts?: {
  activeOnly?: boolean;
}): Promise<CustomerTypeOption[]> {
  const prisma = getPrismaClient();
  const rows = await prisma.customerTypeDefinition.findMany({
    where: opts?.activeOnly ? { isActive: true } : {},
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, code: true, name: true },
  });
  return rows.map(toCustomerTypeOption);
}

export async function getCustomerTypeById(id: string) {
  const prisma = getPrismaClient();
  return prisma.customerTypeDefinition.findUnique({
    where: { id },
    select: {
      id: true,
      code: true,
      name: true,
      isActive: true,
      isSystem: true,
    },
  });
}

export async function assertCustomerTypeUsable(id: string) {
  const row = await getCustomerTypeById(id);
  if (!row) throw new Error("Customer type not found.");
  if (!row.isActive) throw new Error("Customer type is inactive.");
  return row;
}

export async function getCustomerTypeIdByCode(code: string): Promise<string | null> {
  const prisma = getPrismaClient();
  const row = await prisma.customerTypeDefinition.findUnique({
    where: { code },
    select: { id: true },
  });
  return row?.id ?? null;
}

export async function resolveDefaultCustomerTypeId(): Promise<string> {
  const prisma = getPrismaClient();
  const row = await prisma.customerTypeDefinition.findFirst({
    where: { code: "INDUSTRY", isActive: true },
    select: { id: true },
  });
  if (row) return row.id;
  const fallback = await prisma.customerTypeDefinition.findFirst({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true },
  });
  if (!fallback) throw new Error("No customer types configured. Add one in Setup.");
  return fallback.id;
}
