import { redirect } from "next/navigation";
import { getPrismaClient } from "@/lib/prisma";
import { prismaRetry } from "@/lib/prisma-retry";
import { describeDatabaseError } from "@/lib/describe-database-error";
import { DatabaseErrorCallout } from "@/components/DatabaseErrorCallout";
import { getServerSession } from "@/lib/auth-server";
import { roleRequiresSalesPoint } from "@/lib/auth-roles";
import { StorageLocationsClient } from "./StorageLocationsClient";
import { deleteStorageLocation, saveStorageLocation } from "./actions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function StorageLocationsPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");

  const scopedToSalesPoint = roleRequiresSalesPoint(session.role);
  const assignedSalesPointId = session.salesPoint?.id ?? null;
  const assignedSalesPointName = session.salesPoint?.name ?? null;

  if (scopedToSalesPoint && assignedSalesPointId == null) {
    return (
      <div className="space-y-4 max-w-xl">
        <h1 className="text-2xl font-semibold">Storage locations</h1>
        <div className="rounded-lg border border-amber-600/40 bg-amber-600/5 px-4 py-3 text-sm text-amber-950 dark:text-amber-200">
          Your role is tied to a sales point, but none is assigned. Ask an administrator.
        </div>
      </div>
    );
  }

  const prisma = getPrismaClient();
  const spFilter =
    scopedToSalesPoint && assignedSalesPointId != null
      ? { id: assignedSalesPointId }
      : {};
  const locWhere =
    scopedToSalesPoint && assignedSalesPointId != null
      ? { salesPointId: assignedSalesPointId }
      : {};

  let salesPoints: { id: number; name: string }[];
  let locations: Array<{
    id: number;
    name: string;
    salesPointId: number;
    salesPoint: { name: string };
  }>;

  try {
    [salesPoints, locations] = await Promise.all([
      prismaRetry(() =>
        prisma.salesPoint.findMany({
          where: spFilter,
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        }),
      ),
      prismaRetry(() =>
        prisma.storageLocation.findMany({
          where: locWhere,
          orderBy: [{ salesPoint: { name: "asc" } }, { name: "asc" }],
          select: {
            id: true,
            name: true,
            salesPointId: true,
            salesPoint: { select: { name: true } },
          },
        }),
      ),
    ]);
  } catch (e) {
    const { title, description } = describeDatabaseError(e);
    return (
      <div className="space-y-4 max-w-xl">
        <h1 className="text-2xl font-semibold">Storage locations</h1>
        <DatabaseErrorCallout title={title} description={description} />
      </div>
    );
  }

  return (
    <StorageLocationsClient
      salesPoints={salesPoints}
      locations={locations.map((l) => ({
        id: l.id,
        name: l.name,
        salesPointId: l.salesPointId,
        salesPointName: l.salesPoint.name,
      }))}
      salesPointLocked={scopedToSalesPoint}
      lockedSalesPointName={scopedToSalesPoint ? assignedSalesPointName : null}
      saveStorageLocationAction={saveStorageLocation}
      deleteStorageLocationAction={deleteStorageLocation}
    />
  );
}
