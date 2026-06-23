import { siteLabelForKind, type CommercialProfile } from "@/lib/commercial-profile";
import { loadGenericDashboardData } from "@/lib/dashboard/load-dashboard-data";
import { DashboardFilterPanel } from "../_shared/DashboardFilterPanel";
import { DashboardPageLayout } from "../_shared/DashboardPageLayout";
import { DashboardSidebar } from "../_shared/DashboardSidebar";
import { GenericDashboardView } from "../_shared/GenericDashboardView";

export async function GenericLineDashboard(props: {
  serviceName: string;
  profile: CommercialProfile;
}) {
  const { serviceName, profile } = props;
  const data = await loadGenericDashboardData(serviceName, profile.enabledModules);

  return (
    <DashboardPageLayout
      title="Dashboard"
      subtitle={`${serviceName} · ${siteLabelForKind(profile.siteKind)} line`}
      actionHref="/setup"
      actionLabel="Setup"
      sidebar={
        <DashboardSidebar>
          <DashboardFilterPanel
            monthFilter={data.monthFilter}
            hasOpenFy={data.hasOpenFy}
            scopeLabel={serviceName}
            quickLinks={data.quickLinks}
          />
        </DashboardSidebar>
      }
    >
      <GenericDashboardView data={data} />
    </DashboardPageLayout>
  );
}
