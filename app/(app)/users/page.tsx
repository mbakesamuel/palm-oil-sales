import { getPrismaClient } from "@/lib/prisma";
import { ensureGlobalRoleDefinitions } from "@/lib/global-role-definitions";
import { UsersClient } from "./UsersClient";
import { saveUser, setUserActive } from "./actions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function UsersPage() {
  const prisma = getPrismaClient();
  await ensureGlobalRoleDefinitions();
  const [users, salesPoints, factories, commercialServices, serviceRoles, globalRoles] =
    await Promise.all([
      prisma.user.findMany({
        orderBy: [{ isActive: "desc" }, { username: "asc" }],
        select: {
          id: true,
          username: true,
          name: true,
          role: true,
          globalRoleDefinitionId: true,
          globalRoleDefinition: {
            select: { id: true, displayName: true },
          },
          isActive: true,
          salesPointId: true,
          salesPoint: { select: { id: true, name: true } },
          factoryId: true,
          factory: { select: { id: true, name: true } },
          commercialServiceId: true,
          commercialServiceRoleId: true,
          commercialService: {
            select: { id: true, name: true, invoicePrefix: true, siteKind: true },
          },
          commercialServiceRole: {
            select: { id: true, code: true, name: true },
          },
        },
      }),
      prisma.salesPoint.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      prisma.factory.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true, commercialServiceId: true },
      }),
      prisma.commercialService.findMany({
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: { id: true, name: true, invoicePrefix: true, isActive: true, siteKind: true },
      }),
      prisma.commercialServiceRole.findMany({
        where: { isActive: true },
        orderBy: [{ commercialServiceId: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
        select: {
          id: true,
          code: true,
          name: true,
          commercialServiceId: true,
          requiresFixedPostingSite: true,
        },
      }),
      prisma.globalRoleDefinition.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { displayName: "asc" }],
        select: { id: true, code: true, displayName: true, legacyRole: true },
      }),
    ]);

  return (
    <UsersClient
      users={users}
      salesPoints={salesPoints}
      factories={factories}
      commercialServices={commercialServices}
      serviceRoles={serviceRoles}
      globalRoles={globalRoles}
      saveUserAction={saveUser}
      setUserActiveAction={setUserActive}
    />
  );
}
