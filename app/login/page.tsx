import { getPrismaClient } from "@/lib/prisma";
import { getOrInitCompanySettings } from "@/lib/settings";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function LoginPage() {
  const prisma = getPrismaClient();
  const [salesPoints, users, settings] = await Promise.all([
    prisma.salesPoint.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.user.findMany({
      where: { isActive: true },
      orderBy: [{ role: "asc" }, { name: "asc" }],
      select: { id: true, name: true, role: true },
      take: 100,
    }),
    getOrInitCompanySettings(),
  ]);

  return (
    <div className="mx-auto w-full max-w-md px-4 py-10">
      <LoginForm
        salesPoints={salesPoints}
        users={users}
        companyName={settings.companyName}
        department={settings.department}
      />
    </div>
  );
}
