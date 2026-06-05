import { siteLabelForKind, type CommercialProfile } from "@/lib/commercial-profile";
import { loadRubberDashboardData } from "@/lib/dashboard/load-dashboard-data";
import { quickLinksForModules } from "@/lib/dashboard-widgets";
import { DashboardFilterPanel } from "../_shared/DashboardFilterPanel";
import { DashboardPageLayout } from "../_shared/DashboardPageLayout";
import { RubberDashboardView } from "../_shared/RubberDashboardView";

export async function RubberDashboard(props: {
  serviceName: string;
  profile: CommercialProfile;
}) {
  const { serviceName, profile } = props;
  const data = await loadRubberDashboardData(serviceName, profile.enabledModules);

  return (
    <DashboardPageLayout
      title="Dashboard"
      subtitle={`${serviceName} · ${siteLabelForKind(profile.siteKind)} line`}
      actionHref="/stock"
      actionLabel="Stock"
      sidebar={
        <DashboardFilterPanel
          monthFilter={data.monthFilter}
          hasOpenFy={data.hasOpenFy}
          scopeLabel={data.scopeHint}
          quickLinks={quickLinksForModules(profile.enabledModules)}
        />
      }
    >
      <RubberDashboardView data={data} />
    </DashboardPageLayout>
  );
}
