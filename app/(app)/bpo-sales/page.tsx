import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth-server";
import { roleRequiresSalesPoint } from "@/lib/auth-roles";
import { getBotaSalesPointId } from "@/lib/bpo";
import { getPrismaClient } from "@/lib/prisma";
import { prismaRetry } from "@/lib/prisma-retry";
import { createBpoOutboundSale } from "@/app/(app)/stock/bpo-outbound/actions";
import { BpoSalesClient } from "./BpoSalesClient";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function BpoSalesPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  const prisma = getPrismaClient();
  const botaSalesPointId = await getBotaSalesPointId(prisma);
  const scoped = roleRequiresSalesPoint(session.role);
  const canPost = botaSalesPointId != null && (!scoped || session.salesPoint?.id === botaSalesPointId);

  const [variants, sales] = await Promise.all([
    prismaRetry(() =>
      prisma.productVariant.findMany({
        where: { isActive: true, product: { isBottledPalmOil: true } },
        orderBy: [{ product: { productName: "asc" } }, { name: "asc" }],
        select: { id: true, name: true, product: { select: { productName: true } } },
      }),
    ),
    prismaRetry(() =>
      prisma.sale.findMany({
        where: {
          ...(botaSalesPointId != null ? { salesPointId: botaSalesPointId } : {}),
          lines: { some: { product: { isBottledPalmOil: true } } },
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
            where: { product: { isBottledPalmOil: true } },
            include: {
              productVariant: {
                select: { name: true, product: { select: { productName: true } } },
              },
            },
          },
        },
      }),
    ),
  ]);

  return (
    <BpoSalesClient
      variants={variants.map((v) => ({
        id: v.id,
        label: `${v.product.productName} - ${v.name}`,
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
          variantLabel: l.productVariant
            ? `${l.productVariant.product.productName} - ${l.productVariant.name}`
            : "Bottled Palm Oil",
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
