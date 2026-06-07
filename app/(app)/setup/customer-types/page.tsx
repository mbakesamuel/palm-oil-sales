import { getPrismaClient } from "@/lib/prisma";
import { deleteCustomerType, saveCustomerType } from "./actions";
import { CustomerTypesClient } from "./CustomerTypesClient";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function CustomerTypesPage() {
  const prisma = getPrismaClient();
  const types = await prisma.customerTypeDefinition.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      code: true,
      name: true,
      sortOrder: true,
      isActive: true,
      isSystem: true,
      _count: { select: { customers: true, priceSchedules: true } },
    },
  });

  return (
    <CustomerTypesClient
      types={types.map((t) => ({
        id: t.id,
        code: t.code,
        name: t.name,
        sortOrder: t.sortOrder,
        isActive: t.isActive,
        isSystem: t.isSystem,
        usageCount: t._count.customers + t._count.priceSchedules,
      }))}
      saveCustomerTypeAction={saveCustomerType}
      deleteCustomerTypeAction={deleteCustomerType}
    />
  );
}
