import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth-server";
import { sessionRequiresFixedPostingSite } from "@/lib/sales-point-assignment";
import { getBotaSalesPointId } from "@/lib/bpo";
import { getPrismaClient } from "@/lib/prisma";
import { prismaRetry } from "@/lib/prisma-retry";
import { createBpoOutboundSale } from "@/app/(app)/bpo-sales/actions";
import { BpoSalesClient } from "./BpoSalesClient";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function BpoSalesPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  const prisma = getPrismaClient();
  const botaSalesPointId = await getBotaSalesPointId(prisma);
  const scoped = sessionRequiresFixedPostingSite(session);
  const canPost = botaSalesPointId != null && (!scoped || session.salesPoint?.id === botaSalesPointId);

  const [products, sales] = await Promise.all([
    prismaRetry(() =>
      prisma.product.findMany({
        where: { productCat: { isBottled: true } },
        orderBy: { productName: "asc" },
        select: { productId: true, productName: true },
      }),
    ),
    prismaRetry(() =>
      prisma.sale.findMany({
        where: {
          ...(botaSalesPointId != null ? { salesPointId: botaSalesPointId } : {}),
          lines: { some: { product: { productCat: { isBottled: true } } } },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
        include: {
          payments: { orderBy: { id: "asc" }, select: { method: true } },
          bpoEmployeeCreditSale: {
            include: {
              employee: { select: { matricule: true, name: true, estate: true } },
            },
          },
          lines: {
            where: { product: { productCat: { isBottled: true } } },
            include: {
              product: { select: { productName: true } },
            },
          },
        },
      }),
    ),
  ]);

  return (
    <BpoSalesClient
      products={products.map((p) => ({
        productId: p.productId,
        label: p.productName,
      }))}
      sales={sales.map((s) => ({
        id: s.id,
        invoiceNo: s.invoiceNo,
        soldAtIso: s.soldAt.toISOString().slice(0, 10),
        paymentMethod: s.payments.some((p) => p.method === "CREDIT") ? "CREDIT" : "CASH",
        customerName: s.customerNameSnapshot,
        grossAmount: s.grossAmount.toString(),
        employeeLabel: s.bpoEmployeeCreditSale
          ? `${s.bpoEmployeeCreditSale.employee.matricule} · ${s.bpoEmployeeCreditSale.employee.name} · ${s.bpoEmployeeCreditSale.employee.estate}`
          : null,
        lines: s.lines.map((l) => ({
          productLabel: l.product.productName,
          qtyUnits: l.qtyUnits?.toString() ?? "0",
          lineGross: l.lineGross.toString(),
        })),
      }))}
      canPost={canPost}
      botaAvailable={botaSalesPointId != null}
      createSaleAction={createBpoOutboundSale}
    />
  );
}
