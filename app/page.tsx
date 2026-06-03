import { PublicAgroShell } from "@/components/public/PublicAgroShell";
import { WelcomeScreen } from "@/components/WelcomeScreen";
import { getServerSession } from "@/lib/auth-server";
import { resolveHomeDashboardPath } from "@/lib/dashboard-routing";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function Home() {
  const session = await getServerSession();
  if (session) redirect(resolveHomeDashboardPath(session));
  return (
    <PublicAgroShell className="h-dvh w-full overflow-hidden p-0">
      <WelcomeScreen />
    </PublicAgroShell>
  );
}
