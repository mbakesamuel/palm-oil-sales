import { getServerSession } from "@/lib/auth-server";
import { assertExecutiveDashboardAccess } from "@/lib/dashboard-access";
import { ExecutiveDashboard } from "../variants/ExecutiveDashboard";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function ExecutiveDashboardPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  assertExecutiveDashboardAccess(session);
  return <ExecutiveDashboard />;
}
