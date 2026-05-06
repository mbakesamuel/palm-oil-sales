import { getPrismaClient } from "@/lib/prisma";
import { CustomersClient } from "./CustomersClient";
import { deleteCustomer, saveCustomer } from "./actions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function CustomersPage() {
  const prisma = getPrismaClient();

  const taxRegimes = await prisma.taxRegime.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, vatApplies: true },
  });

  const customers = await prisma.customer.findMany({
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      address: true,
      customerType: true,
      residency: true,
      hasTaxpayerId: true,
      taxpayerId: true,
      taxRegime: { select: { id: true, name: true, vatApplies: true } },
      createdAt: true,
    },
    take: 50,
  });

  return (
    <CustomersClient
      taxRegimes={taxRegimes}
      customers={customers.map((c) => ({
        ...c,
        createdAtIso: c.createdAt.toISOString(),
      }))}
      saveCustomerAction={saveCustomer}
      deleteCustomerAction={deleteCustomer}
    />
  );
}

