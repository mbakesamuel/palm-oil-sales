import { Link } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { MOBILE_REPORT_LINKS, MOBILE_STOCK_LINKS } from "@pos/shared";
import { useAuth } from "@/auth/AuthProvider";

export default function HomeScreen() {
  const { session, logout, hasPermission } = useAuth();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.greeting}>Hello, {session?.displayName}</Text>
      <Text style={styles.meta}>
        {session?.roleLabel ?? session?.role}
        {session?.salesPoint ? ` · ${session.salesPoint.name}` : ""}
      </Text>

      <Text style={styles.section}>Reports</Text>
      {MOBILE_REPORT_LINKS.filter((r) => hasPermission(r.permission)).map((r) => (
        <Link key={r.id} href={`/(app)/reports/${r.id}` as never} asChild>
          <Pressable style={styles.card}>
            <Text style={styles.cardTitle}>{r.label}</Text>
          </Pressable>
        </Link>
      ))}

      {MOBILE_STOCK_LINKS.filter((s) => hasPermission(s.permission)).length > 0 ? (
        <>
          <Text style={styles.section}>Stock</Text>
          {MOBILE_STOCK_LINKS.filter((s) => hasPermission(s.permission)).map((s) => (
            <Link key={s.id} href={`/(app)/stock/${s.id}` as never} asChild>
              <Pressable style={styles.card}>
                <Text style={styles.cardTitle}>{s.label}</Text>
                <Text style={styles.cardDesc}>{s.description}</Text>
              </Pressable>
            </Link>
          ))}
        </>
      ) : null}

      {hasPermission("ui:validate-documents") ||
      hasPermission("route:/delivery-orders/validation-queue") ||
      hasPermission("ui:validate-delivery-orders") ? (
        <>
          <Text style={styles.section}>Approvals</Text>
          <Link href="/(app)/validation" asChild>
            <Pressable style={styles.card}>
              <Text style={styles.cardTitle}>Approvals inbox</Text>
              <Text style={styles.cardDesc}>
                Review sales and delivery orders before validating
              </Text>
            </Pressable>
          </Link>
        </>
      ) : null}

      <Pressable style={styles.logout} onPress={() => void logout()}>
        <Text style={styles.logoutText}>Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 10 },
  greeting: { fontSize: 22, fontWeight: "700" },
  meta: { opacity: 0.65, marginBottom: 12 },
  section: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: 12,
    color: "#2d5016",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8e0",
  },
  cardTitle: { fontSize: 16, fontWeight: "600" },
  cardDesc: { fontSize: 12, opacity: 0.65, marginTop: 4 },
  logout: { marginTop: 24, alignItems: "center" },
  logoutText: { color: "#b91c1c", fontWeight: "600" },
});
