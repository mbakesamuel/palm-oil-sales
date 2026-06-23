import { DashboardFilterPanel } from "../_shared/DashboardFilterPanel";
import { DashboardPageLayout } from "../_shared/DashboardPageLayout";
import { DashboardSidebar } from "../_shared/DashboardSidebar";
import { ExecutiveDashboardView } from "../_shared/ExecutiveDashboardView";
import { loadExecutiveDashboardData } from "@/lib/dashboard/load-dashboard-data";

export async function ExecutiveDashboard() {
  const data = await loadExecutiveDashboardData();

  return (
    <DashboardPageLayout
      title="Executive dashboard"
      subtitle="Cross-line overview for the current working month"
      actionHref="/setup"
      actionLabel="Setup"
      sidebar={
        <DashboardSidebar>
          <DashboardFilterPanel
            monthFilter={data.monthFilter}
            hasOpenFy={data.hasOpenFy}
            scopeLabel="All commercial lines"
          />
        </DashboardSidebar>
      }
    >
      <ExecutiveDashboardView data={data} />
    </DashboardPageLayout>
  );
}
