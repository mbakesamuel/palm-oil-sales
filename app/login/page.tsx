import { PublicAgroShell } from "@/components/public/PublicAgroShell";
import { resolveCompanyLogoSrc } from "@/lib/company-logo";
import { getServerSession } from "@/lib/auth-server";
import { resolveHomeDashboardPath } from "@/lib/dashboard-routing";
import { getOrInitCompanySettings } from "@/lib/settings";
import { redirect } from "next/navigation";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function LoginPage() {
  const session = await getServerSession();
  if (session) redirect(resolveHomeDashboardPath(session));

  const settings = await getOrInitCompanySettings();

  return (
    <PublicAgroShell className="min-h-dvh items-center justify-center overflow-y-auto px-4 py-10">
      <div className="mx-auto w-full max-w-md">
        <LoginForm
          companyName={settings.companyName}
          department={settings.department}
          logoSrc={resolveCompanyLogoSrc(settings.logoUrl)}
        />
      </div>
    </PublicAgroShell>
  );
}
