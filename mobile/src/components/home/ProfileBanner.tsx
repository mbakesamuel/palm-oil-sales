import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import type { MobileSessionPayload } from "@pos/shared";
import { agro } from "@/theme/agro";

function initials(displayName: string) {
  return displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function roleLineForSession(session: MobileSessionPayload) {
  const parts = [
    session.roleLabel ?? session.role,
    session.commercialServiceRole?.name ?? session.commercialService?.name,
  ].filter(Boolean);
  return parts.join(" - ");
}

export function ProfileBanner(props: { session: MobileSessionPayload }) {
  const { session } = props;

  return (
    <View style={styles.wrap}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initials(session.displayName)}</Text>
      </View>
      <View style={styles.body}>
        <Text style={styles.name}>{session.displayName}</Text>
        <Text style={styles.role}>{roleLineForSession(session)}</Text>
        <View style={styles.profileLink}>
          <Text style={styles.profileLinkText}>View Personal Profile</Text>
          <Ionicons name="chevron-down" size={14} color={agro.leaf} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 20,
    backgroundColor: agro.panel,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: agro.forest,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#e8f0e4",
  },
  avatarText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  body: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: 18,
    fontWeight: "700",
    color: agro.text,
  },
  role: {
    fontSize: 13,
    color: agro.textMuted,
  },
  profileLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 6,
  },
  profileLinkText: {
    fontSize: 13,
    color: agro.leaf,
    fontWeight: "600",
  },
});
