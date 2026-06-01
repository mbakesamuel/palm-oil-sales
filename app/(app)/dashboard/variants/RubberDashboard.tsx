import { DashboardSessionCard } from "../DashboardSessionCard";
import { DashboardStockStats } from "../DashboardStockStats";
import { DashboardIncomingTransfers } from "../DashboardIncomingTransfers";
import { DashboardShell } from "../_shared/DashboardShell";
import { DashboardQuickLinks } from "../widgets/DashboardQuickLinks";
import { siteLabelForKind, type CommercialProfile } from "@/lib/commercial-profile";

export function RubberDashboard(props: {
  serviceName: string;
  profile: CommercialProfile;
}) {
  const { serviceName, profile } = props;
  return (
    <DashboardShell
      title="Dashboard"
      subtitle={`${serviceName} · ${siteLabelForKind(profile.siteKind)} line`}
    >
      <DashboardSessionCard />
      <DashboardStockStats />
      <DashboardIncomingTransfers />
      <DashboardQuickLinks enabledModules={profile.enabledModules} />
    </DashboardShell>
  );
}
