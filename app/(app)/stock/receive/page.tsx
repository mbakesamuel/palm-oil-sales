import { redirect } from "next/navigation";
import { getPrismaClient } from "@/lib/prisma";
import { prismaRetry } from "@/lib/prisma-retry";
import { describeDatabaseError } from "@/lib/describe-database-error";
import { getServerSession } from "@/lib/auth-server";
import { roleRequiresSalesPoint } from "@/lib/auth-roles";
import { DatabaseErrorCallout } from "@/components/DatabaseErrorCallout";
import { prismaDateToIso } from "@/lib/posting-calendar";
import { ReceiveStockClient } from "./ReceiveStockClient";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function ReceiveStockPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");

  const scopedToSalesPoint = roleRequiresSalesPoint(session.role);
  const assignedSalesPointId = session.salesPoint?.id ?? null;

  if (scopedToSalesPoint && assignedSalesPointId == null) {
    return (
      <div className="space-y-4 max-w-xl">
        <h1 className="text-2xl font-semibold">Receive stock</h1>
        <div className="rounded-lg border border-amber-600/40 bg-amber-600/5 px-4 py-3 text-sm text-amber-950 dark:text-amber-200">
          Your role is tied to a sales point, but none is assigned. Ask an
          administrator.
        </div>
      </div>
    );
  }

  const prisma = getPrismaClient();
  const spFilter =
    scopedToSalesPoint && assignedSalesPointId != null
      ? { salesPointId: assignedSalesPointId }
      : {};

  let salesPoints: { id: number; name: string }[];
  let products: { productId: number; productName: string }[];
  let storageLocations: { id: number; name: string; salesPointId: number }[];
  let recentReceipts: Array<{
    id: string;
    salesPointId: number;
    storageLocationId: number;
    storageLocationName: string;
    productId: number;
    productName: string;
    receivedAtIso: string;
    qtyReceivedKg: string;
    qtyRemainingKg: string;
    costPerKg: string;
    note: string | null;
    hasAllocations: boolean;
  }>;

  try {
    [salesPoints, products, storageLocations, recentReceipts] = await Promise.all([
      prismaRetry(() =>
        prisma.salesPoint.findMany({
          where:
            scopedToSalesPoint && assignedSalesPointId != null
              ? { id: assignedSalesPointId }
              : {},
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        }),
      ),
      prismaRetry(() =>
        prisma.product.findMany({
          orderBy: { productName: "asc" },
          select: { productId: true, productName: true },
        }),
      ),
      prismaRetry(() =>
        prisma.storageLocation.findMany({
          where: spFilter,
          orderBy: { name: "asc" },
          select: { id: true, name: true, salesPointId: true },
        }),
      ),
      prismaRetry(() =>
        prisma.batch.findMany({
          where: spFilter,
          orderBy: { receivedAt: "desc" },
          take: 100,
          select: {
            id: true,
            salesPointId: true,
            storageLocationId: true,
            productId: true,
            receivedAt: true,
            costPerKg: true,
            qtyReceivedKg: true,
            qtyRemainingKg: true,
            note: true,
            _count: { select: { saleLineAllocations: true } },
            product: { select: { productName: true } },
            storageLocation: { select: { name: true } },
          },
        }),
      ).then((rows) =>
        rows.map((b) => ({
          id: b.id,
          salesPointId: b.salesPointId,
          storageLocationId: b.storageLocationId,
          storageLocationName: b.storageLocation.name,
          productId: b.productId,
          productName: b.product.productName,
          receivedAtIso: prismaDateToIso(b.receivedAt),
          qtyReceivedKg: b.qtyReceivedKg.toString(),
          qtyRemainingKg: b.qtyRemainingKg.toString(),
          costPerKg: b.costPerKg.toString(),
          note: b.note,
          hasAllocations: b._count.saleLineAllocations > 0,
        })),
      ),
    ]);
  } catch (e) {
    const { title, description } = describeDatabaseError(e);
    return (
      <div className="space-y-6 max-w-xl">
        <div>
          <h1 className="text-2xl font-semibold">Receipt stock from Mill</h1>
          <p className="mt-1 text-sm opacity-80">
            Record a new batch at a collection point and where it is physically stored.
          </p>
        </div>
        <DatabaseErrorCallout title={title} description={description} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Receipt stock from Mill</h1>
        <p className="mt-1 text-sm opacity-80">
          Record a new batch at a collection point and where it is physically stored. Validated
          sales use one stock pool per collection point and product (oldest receipt first across all
          storage locations at that point).
        </p>
      </div>

      <ReceiveStockClient
        salesPoints={salesPoints}
        products={products}
        storageLocations={storageLocations}
        recentReceipts={recentReceipts}
        defaultSalesPointId={assignedSalesPointId}
        salesPointLocked={scopedToSalesPoint}
      />
    </div>
  );
}
