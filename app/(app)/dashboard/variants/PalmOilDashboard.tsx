import { DashboardFilterPanel } from "../_shared/DashboardFilterPanel";
import { DashboardPageLayout } from "../_shared/DashboardPageLayout";
import { PalmOilDashboardView } from "../_shared/PalmOilDashboardView";
import { loadPalmOilDashboardData } from "@/lib/dashboard/load-dashboard-data";
import { quickLinksForModules } from "@/lib/dashboard-widgets";
import type { CommercialProfile } from "@/lib/commercial-profile";

export async function PalmOilDashboard(props: {
  serviceName: string;
  commercialServiceId: string;
  profile: CommercialProfile;
}) {
  const { serviceName, commercialServiceId, profile } = props;
  const data = await loadPalmOilDashboardData(
    commercialServiceId,
    serviceName,
    profile.enabledModules,
  );

  const scopeLabel = data.stock?.scopeHint ?? serviceName;

  return (
    <DashboardPageLayout
      title="Dashboard"
      subtitle={`${serviceName} · Operational overview for the working month`}
      actionHref="/setup"
      actionLabel="Setup"
      sidebar={
        <DashboardFilterPanel
          monthFilter={data.monthFilter}
          hasOpenFy={data.hasOpenFy}
          scopeLabel={scopeLabel}
          quickLinks={quickLinksForModules(profile.enabledModules)}
        />
      }
    >
      <PalmOilDashboardView data={data} />
    </DashboardPageLayout>
  );
}
