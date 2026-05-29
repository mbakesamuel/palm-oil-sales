import { DashboardSessionCard } from "../DashboardSessionCard";
import { DashboardShell } from "../_shared/DashboardShell";
import { DashboardQuickLinks } from "../widgets/DashboardQuickLinks";
import { siteLabelForKind, type CommercialProfile } from "@/lib/commercial-profile";

export function GenericLineDashboard(props: {
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
      <p className="text-sm opacity-80">
        Choose a module from the sidebar to start working.
      </p>
      <DashboardQuickLinks enabledModules={profile.enabledModules} />
    </DashboardShell>
  );
}
