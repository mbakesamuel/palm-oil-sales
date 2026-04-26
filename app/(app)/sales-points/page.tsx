import { getPrismaClient } from "@/lib/prisma";
import { SalesPointsClient } from "./SalesPointsClient";
import { deleteSalesPoint, saveSalesPoint } from "./actions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function SalesPointsPage() {
  const prisma = getPrismaClient();
  const points = await prisma.salesPoint.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <SalesPointsClient
      points={points}
      saveSalesPointAction={saveSalesPoint}
      deleteSalesPointAction={deleteSalesPoint}
    />
  );
}
