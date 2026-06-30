import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import type { MobileSessionPayload } from "@pos/shared";
import { useAuth } from "@/auth/AuthProvider";
import { ActionGrid } from "@/components/home/ActionGrid";
import { HomeHeader } from "@/components/home/HomeHeader";
import { HomeTabs } from "@/components/home/HomeTabs";
import { ProfileBanner } from "@/components/home/ProfileBanner";
import {
  homeApprovalAction,
  homeMoreActions,
  homePosActions,
  homeReportActions,
  homeStockActions,
  homeTabs,
  type HomeAction,
  type HomeTabId,
} from "@/constants/home-actions";
import { canOpenMobileApprovals } from "@/constants/validation-access";
import { useSafePadding } from "@/hooks/use-safe-padding";
import { agro, agroHomeSheet } from "@/theme/agro";

function isActionAllowed(
  action: HomeAction,
  hasPermission: (key: string) => boolean,
  session: MobileSessionPayload | null,
) {
  if (action.permission === "__always__") return true;
  if (action.permission === "__approvals__") {
    return canOpenMobileApprovals(hasPermission, session);
  }
  if (action.permission === "__raise_sale__") {
    return hasPermission("route:/pos") && hasPermission("ui:validate-documents");
  }
  return hasPermission(action.permission);
}

export default function HomeScreen() {
  const { session, logout, hasPermission } = useAuth();
  const router = useRouter();
  const { scrollBottom } = useSafePadding();
  const [tab, setTab] = useState<HomeTabId>("dashboard");

  const canApprovals = canOpenMobileApprovals(hasPermission, session);

  const actionsByTab = useMemo(() => {
    const all = [
      ...homeReportActions,
      ...homeStockActions,
      ...homePosActions,
      homeApprovalAction,
      ...homeMoreActions,
    ].filter((action) => isActionAllowed(action, hasPermission, session));

    return {
      dashboard: all.filter((a) => a.tab === "dashboard"),
      approvals: all.filter((a) => a.tab === "approvals"),
      more: all.filter((a) => a.tab === "more"),
    };
  }, [hasPermission, session]);

  const visibleTabs = useMemo(
    () =>
      homeTabs.filter((t) => {
        const items = actionsByTab[t.id];
        return items.length > 0 || t.id === "dashboard";
      }),
    [actionsByTab],
  );

  const activeTab = visibleTabs.some((t) => t.id === tab)
    ? tab
    : (visibleTabs[0]?.id ?? "dashboard");

  const activeActions = actionsByTab[activeTab];

  function onAction(action: HomeAction) {
    if (action.id === "sign-out") {
      void logout();
    }
  }

  if (!session) return null;

  return (
    <View style={styles.screen}>
      <View style={styles.topPanel}>
        <HomeHeader
          title="Sales Monitor"
          notificationCount={canApprovals ? 1 : 0}
          onNotifications={
            canApprovals ? () => router.push("/(app)/validation" as never) : undefined
          }
          onSignOut={() => void logout()}
        />
        <ProfileBanner session={session} />
      </View>

      <View style={styles.contentSheet}>
        <HomeTabs tabs={visibleTabs} active={activeTab} onChange={setTab} />
        <ScrollView
          style={styles.contentScroll}
          contentContainerStyle={[
            styles.contentInner,
            { paddingBottom: scrollBottom + 24 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <ActionGrid
            actions={activeActions}
            onAction={onAction}
            emptyMessage={
              activeTab === "approvals"
                ? "No approval workflows are enabled for your role."
                : "No modules available on this tab."
            }
          />
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: agro.panel,
  },
  topPanel: {
    backgroundColor: agro.panel,
  },
  contentSheet: {
    flex: 1,
    backgroundColor: agroHomeSheet.backgroundColor,
    borderTopLeftRadius: agroHomeSheet.radius,
    borderTopRightRadius: agroHomeSheet.radius,
    overflow: "hidden",
  },
  contentScroll: {
    flex: 1,
  },
  contentInner: {
    flexGrow: 1,
  },
});
