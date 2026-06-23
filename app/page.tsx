import { PublicAgroShell } from "@/components/public/PublicAgroShell";
import { WelcomeScreen } from "@/components/WelcomeScreen";
import { resolveCompanyLogoSrc } from "@/lib/company-logo";
import { getServerSession } from "@/lib/auth-server";
import { resolveHomeDashboardPath } from "@/lib/dashboard-routing";
import { getOrInitCompanySettings } from "@/lib/settings";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function Home() {
  const session = await getServerSession();
  if (session) redirect(resolveHomeDashboardPath(session));

  const settings = await getOrInitCompanySettings();

  return (
    <PublicAgroShell className="h-dvh w-full overflow-hidden p-0">
      <WelcomeScreen
        companyName={settings.companyName}
        logoSrc={resolveCompanyLogoSrc(settings.logoUrl)}
      />
    </PublicAgroShell>
  );
}
