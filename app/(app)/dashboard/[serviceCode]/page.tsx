import { getServerSession } from "@/lib/auth-server";
import { assertLineDashboardAccess } from "@/lib/dashboard-access";
import { lineDashboardVariantForCode } from "@/lib/dashboard-routing";
import { GenericLineDashboard } from "../variants/GenericLineDashboard";
import { PalmOilDashboard } from "../variants/PalmOilDashboard";
import { RubberDashboard } from "../variants/RubberDashboard";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type PageProps = {
  params: Promise<{ serviceCode: string }>;
};

export default async function LineDashboardPage({ params }: PageProps) {
  const session = await getServerSession();
  if (!session) redirect("/login");

  const { serviceCode } = await params;
  const service = await assertLineDashboardAccess(session, serviceCode);
  const variant = lineDashboardVariantForCode(service.code);

  if (variant === "palm-oil") {
    return (
      <PalmOilDashboard
        serviceName={service.name}
        commercialServiceId={service.id}
        profile={service.profile}
      />
    );
  }

  if (variant === "rubber") {
    return (
      <RubberDashboard serviceName={service.name} profile={service.profile} />
    );
  }

  return (
    <GenericLineDashboard serviceName={service.name} profile={service.profile} />
  );
}
