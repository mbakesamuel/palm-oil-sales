import { DashboardSessionCard } from "../DashboardSessionCard";
import { DashboardStats } from "../DashboardStats";
import { DashboardStockStats } from "../DashboardStockStats";
import { DashboardIncomingTransfers } from "../DashboardIncomingTransfers";
import { DashboardShell } from "../_shared/DashboardShell";
import { DashboardQuickLinks } from "../widgets/DashboardQuickLinks";
import type { CommercialProfile } from "@/lib/commercial-profile";

export function PalmOilDashboard(props: {
  serviceName: string;
  commercialServiceId: string;
  profile: CommercialProfile;
}) {
  const { serviceName, commercialServiceId, profile } = props;
  return (
    <DashboardShell
      title="Dashboard"
      subtitle={`${serviceName} · Choose a module from the sidebar to start working.`}
    >
      <DashboardSessionCard />
      <DashboardStats commercialServiceId={commercialServiceId} />
      <DashboardStockStats />
      <DashboardIncomingTransfers />
      <DashboardQuickLinks enabledModules={profile.enabledModules} />
    </DashboardShell>
  );
}
