import { getPrismaClient } from "@/lib/prisma";
import { getServerSession } from "@/lib/auth-server";
import { roleSeesAllCommercialServices } from "@/lib/service-scope";
import { FactoriesClient } from "./FactoriesClient";
import { deleteFactory, saveFactory } from "./actions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function FactoriesPage() {
  const session = await getServerSession();
  const prisma = getPrismaClient();

  const commercialServices = await prisma.commercialService.findMany({
    where: {
      siteKind: "FACTORY",
      isActive: true,
      ...(session && !roleSeesAllCommercialServices(session.role) && session.commercialService
        ? { id: session.commercialService.id }
        : {}),
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true },
  });

  const factories = await prisma.factory.findMany({
    where: {
      ...(session && !roleSeesAllCommercialServices(session.role) && session.commercialService
        ? { commercialServiceId: session.commercialService.id }
        : {}),
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      isActive: true,
      commercialServiceId: true,
      commercialService: { select: { name: true } },
    },
  });

  return (
    <FactoriesClient
      factories={factories}
      commercialServices={commercialServices}
      defaultCommercialServiceId={session?.commercialService?.id ?? null}
      saveFactoryAction={saveFactory}
      deleteFactoryAction={deleteFactory}
    />
  );
}
