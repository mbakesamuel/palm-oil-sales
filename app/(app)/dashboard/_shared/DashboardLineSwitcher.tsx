import { getServerSession } from "@/lib/auth-server";
import {
  canAccessExecutiveDashboard,
  lineDashboardPath,
} from "@/lib/dashboard-routing";
import { getPrismaClient } from "@/lib/prisma";
import { DashboardLineSwitcherNav } from "./DashboardLineSwitcherNav";

const EXECUTIVE_HREF = "/dashboard/executive";

export async function DashboardLineSwitcher() {
  const session = await getServerSession();
  if (!session || !canAccessExecutiveDashboard(session)) return null;

  const services = await getPrismaClient().commercialService.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { code: true, name: true },
  });

  if (services.length === 0) return null;

  return (
    <DashboardLineSwitcherNav
      executiveHref={EXECUTIVE_HREF}
      lines={services.map((service) => ({
        code: service.code,
        name: service.name,
        href: lineDashboardPath(service.code),
      }))}
    />
  );
}
