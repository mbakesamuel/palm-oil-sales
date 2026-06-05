import { getPrismaClient } from "@/lib/prisma";
import { deletePaymentMethod, savePaymentMethod } from "./actions";
import { PaymentMethodsClient } from "./PaymentMethodsClient";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function PaymentMethodsPage() {
  const prisma = getPrismaClient();
  const methods = await prisma.paymentMethodDefinition.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      code: true,
      name: true,
      kind: true,
      sortOrder: true,
      isActive: true,
      isSystem: true,
      _count: { select: { payments: true, deliveryOrderPayments: true } },
    },
  });

  return (
    <PaymentMethodsClient
      methods={methods.map((m) => ({
        id: m.id,
        code: m.code,
        name: m.name,
        kind: m.kind,
        sortOrder: m.sortOrder,
        isActive: m.isActive,
        isSystem: m.isSystem,
        usageCount: m._count.payments + m._count.deliveryOrderPayments,
      }))}
      savePaymentMethodAction={savePaymentMethod}
      deletePaymentMethodAction={deletePaymentMethod}
    />
  );
}
