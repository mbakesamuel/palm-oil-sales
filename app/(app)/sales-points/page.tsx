import { getPrismaClient } from "@/lib/prisma";
import { SalesPointsClient } from "./SalesPointsClient";
import {
  deleteSalesPoint,
  deleteStorageLocation,
  saveSalesPoint,
  saveStorageLocation,
  setDefaultStorageLocation,
} from "./actions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function SalesPointsPage() {
  const prisma = getPrismaClient();
  const points = await prisma.salesPoint.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      storageLocations: {
        orderBy: { name: "asc" },
        select: {
          id: true,
          salesPointId: true,
          name: true,
          isDefault: true,
        },
      },
    },
  });

  return (
    <SalesPointsClient
      points={points.map((p) => ({
        id: p.id,
        name: p.name,
        storageLocations: p.storageLocations,
      }))}
      saveSalesPointAction={saveSalesPoint}
      deleteSalesPointAction={deleteSalesPoint}
      saveStorageLocationAction={saveStorageLocation}
      deleteStorageLocationAction={deleteStorageLocation}
      setDefaultStorageLocationAction={setDefaultStorageLocation}
    />
  );
}
