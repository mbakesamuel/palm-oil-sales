import { resolveCompanyLogoSrc } from "@/lib/company-logo";
import { getOrInitCompanySettings } from "@/lib/settings";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function LoginPage() {
  const settings = await getOrInitCompanySettings();

  return (
    <div className="mx-auto w-full max-w-md px-4 py-10">
      <LoginForm
        companyName={settings.companyName}
        department={settings.department}
        logoSrc={resolveCompanyLogoSrc(settings.logoUrl)}
      />
    </div>
  );
}
