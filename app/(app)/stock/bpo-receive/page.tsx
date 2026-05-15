import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth-server";
import { roleRequiresSalesPoint } from "@/lib/auth-roles";
import { getBotaSalesPointId } from "@/lib/bpo";
import { prismaDateToIso } from "@/lib/posting-calendar";
import { getPrismaClient } from "@/lib/prisma";
import { prismaRetry } from "@/lib/prisma-retry";
import { BpoReceiveClient } from "./BpoReceiveClient";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function BpoReceivePage() {
  const session = await getServerSession();
  if (!session) redirect("/login");

  const scopedToSalesPoint = roleRequiresSalesPoint(session.role);
  const assignedSalesPointId = session.salesPoint?.id ?? null;
  const pageTitle = scopedToSalesPoint
    ? "Bottle Palm Oil Stock Reception."
    : "Bottled Palm Oil Stock";

  if (scopedToSalesPoint && assignedSalesPointId == null) {
    return (
      <div className="space-y-4 max-w-xl">
        <h1 className="text-2xl font-semibold">{pageTitle}</h1>
        <div className="rounded-lg border border-amber-600/40 bg-amber-600/5 px-4 py-3 text-sm text-amber-950 dark:text-amber-200">
          Your role is tied to a sales point, but none is assigned. Ask an administrator.
        </div>
      </div>
    );
  }

  const prisma = getPrismaClient();
  const botaSalesPointId = await getBotaSalesPointId(prisma);
  const visibleSalesPointWhere =
    scopedToSalesPoint && assignedSalesPointId != null
      ? { id: assignedSalesPointId }
      : botaSalesPointId != null
        ? { id: { not: botaSalesPointId } }
        : {};
  const receiptWhere =
    scopedToSalesPoint && assignedSalesPointId != null
      ? { salesPointId: assignedSalesPointId }
      : botaSalesPointId != null
        ? { salesPointId: { not: botaSalesPointId } }
        : {};

  const [salesPoints, variants, recentReceipts] = await Promise.all([
    prismaRetry(() =>
      prisma.salesPoint.findMany({
        where: visibleSalesPointWhere,
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
    ),
    prismaRetry(() =>
      prisma.productVariant.findMany({
        where: { isActive: true, product: { isBottledPalmOil: true } },
        orderBy: [{ product: { productName: "asc" } }, { name: "asc" }],
        select: {
          id: true,
          name: true,
          unitLabel: true,
          product: { select: { productName: true } },
        },
      }),
    ),
    prismaRetry(() =>
      prisma.bpoStockBatch.findMany({
        where: receiptWhere,
        orderBy: { receivedAt: "desc" },
        take: 100,
        select: {
          id: true,
          salesPointId: true,
          productVariantId: true,
          receivedAt: true,
          qtyReceivedUnits: true,
          qtyRemainingUnits: true,
          note: true,
          salesPoint: { select: { name: true } },
          productVariant: {
            select: {
              name: true,
              unitLabel: true,
              product: { select: { productName: true } },
            },
          },
          _count: { select: { saleLineAllocations: true } },
        },
      }),
    ),
  ]);

  const mappedReceipts = recentReceipts.map((row) => ({
    id: row.id,
    salesPointId: row.salesPointId,
    salesPointName: row.salesPoint.name,
    productVariantId: row.productVariantId,
    variantLabel: `${row.productVariant.product.productName} - ${row.productVariant.name}`,
    unitLabel: row.productVariant.unitLabel,
    receivedAtIso: prismaDateToIso(row.receivedAt),
    qtyReceivedUnits: row.qtyReceivedUnits.toString(),
    qtyRemainingUnits: row.qtyRemainingUnits.toString(),
    note: row.note,
    hasConsumption:
      row._count.saleLineAllocations > 0 ||
      !row.qtyReceivedUnits.equals(row.qtyRemainingUnits),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{pageTitle}</h1>
        <p className="mt-1 text-sm opacity-80">
          Record Bottled Palm Oil unit stock at non-Bota sales points. Bota receives BPO only after
          validating sender consignment documents.
        </p>
      </div>

      {botaSalesPointId == null ? (
        <div className="rounded-lg border border-amber-600/40 bg-amber-600/5 px-4 py-3 text-sm text-amber-950 dark:text-amber-200">
          Create a sales point named Bota so the app can exclude it from direct BPO receipts.
        </div>
      ) : null}

      <BpoReceiveClient
        salesPoints={salesPoints}
        variants={variants.map((v) => ({
          id: v.id,
          label: `${v.product.productName} - ${v.name}`,
          unitLabel: v.unitLabel,
        }))}
        recentReceipts={mappedReceipts}
        defaultSalesPointId={assignedSalesPointId}
        salesPointLocked={scopedToSalesPoint}
        canEditReceiptRows={scopedToSalesPoint}
      />
    </div>
  );
}
