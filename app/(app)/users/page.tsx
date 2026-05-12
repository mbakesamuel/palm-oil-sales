import { getPrismaClient } from "@/lib/prisma";
import { UsersClient } from "./UsersClient";
import { saveUser, setUserActive } from "./actions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function UsersPage() {
  const prisma = getPrismaClient();
  const [users, salesPoints] = await Promise.all([
    prisma.user.findMany({
      orderBy: [{ isActive: "desc" }, { username: "asc" }],
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        isActive: true,
        salesPointId: true,
        salesPoint: { select: { id: true, name: true } },
        service: true,
      },
    }),
    prisma.salesPoint.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <UsersClient
      users={users}
      salesPoints={salesPoints}
      saveUserAction={saveUser}
      setUserActiveAction={setUserActive}
    />
  );
}
