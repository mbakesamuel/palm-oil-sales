import { Ionicons } from "@expo/vector-icons";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafePadding } from "@/hooks/use-safe-padding";
import { agro } from "@/theme/agro";

export function HomeHeader(props: {
  title: string;
  notificationCount?: number;
  onNotifications?: () => void;
  onSignOut: () => void;
}) {
  const { top } = useSafePadding();
  const count = props.notificationCount ?? 0;
  const badgeLabel = count > 9 ? "9+" : String(count);

  function onMenuPress() {
    Alert.alert("Account", undefined, [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: props.onSignOut },
    ]);
  }

  return (
    <View style={[styles.wrap, { paddingTop: top + 8 }]}>
      <Pressable
        style={styles.iconBtn}
        onPress={onMenuPress}
        accessibilityRole="button"
        accessibilityLabel="Menu"
      >
        <Ionicons name="menu-outline" size={24} color={agro.text} />
      </Pressable>

      <Text style={styles.title} numberOfLines={1}>
        {props.title}
      </Text>

      <Pressable
        style={styles.iconBtn}
        onPress={props.onNotifications}
        disabled={!props.onNotifications}
        accessibilityRole="button"
        accessibilityLabel="Notifications"
      >
        <Ionicons
          name="notifications-outline"
          size={22}
          color={props.onNotifications ? agro.text : agro.textSoft}
        />
        {count > 0 ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badgeLabel}</Text>
          </View>
        ) : null}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingBottom: 4,
    backgroundColor: agro.panel,
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
  },
  title: {
    flex: 1,
    textAlign: "center",
    fontSize: 17,
    fontWeight: "700",
    color: agro.text,
    paddingHorizontal: 8,
  },
  badge: {
    position: "absolute",
    top: 4,
    right: 2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: agro.danger,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: agro.panel,
  },
  badgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
  },
});
