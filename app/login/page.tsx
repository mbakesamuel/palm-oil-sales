import { getPrismaClient } from "@/lib/prisma";
import { getOrInitCompanySettings } from "@/lib/settings";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function LoginPage() {
  const prisma = getPrismaClient();
  const [salesPoints, settings] = await Promise.all([
    prisma.salesPoint.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    getOrInitCompanySettings(),
  ]);

  return (
    <div className="mx-auto w-full max-w-md px-4 py-10">
      <LoginForm
        salesPoints={salesPoints}
        companyName={settings.companyName}
        department={settings.department}
      />
    </div>
  );
}
