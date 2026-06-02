import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Link } from "expo-router";
import type { MobilePendingSaleRow } from "@pos/shared";
import { apiFetch } from "@/api/client";
import { useAuth } from "@/auth/AuthProvider";
import { useSafePadding } from "@/hooks/use-safe-padding";

type PendingSalesResponse = { rows: MobilePendingSaleRow[] };

type DoQueueResponse = {
  rows: Array<{
    id: number;
    deliveryOrderNo: string;
    customerName: string;
    reviewedAtIso: string | null;
  }>;
  totalPending: number;
};

export default function ValidationScreen() {
  const { hasPermission } = useAuth();
  const { scrollBottom } = useSafePadding();
  const [sales, setSales] = useState<MobilePendingSaleRow[]>([]);
  const [dos, setDos] = useState<DoQueueResponse["rows"]>([]);
  const [busy, setBusy] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      if (hasPermission("ui:validate-documents")) {
        const res = await apiFetch<PendingSalesResponse>(
          "/api/mobile/v1/validation/sales",
        );
        setSales(res.rows);
      }
      if (
        hasPermission("route:/delivery-orders/validation-queue") ||
        hasPermission("ui:validate-delivery-orders")
      ) {
        const res = await apiFetch<DoQueueResponse>(
          "/api/mobile/v1/validation/delivery-orders?reviewed=all",
        );
        setDos(res.rows);
      }
    } finally {
      setBusy(false);
    }
  }, [hasPermission]);

  useEffect(() => {
    void load();
  }, [load]);

  if (busy) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2d5016" />
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={[styles.container, { paddingBottom: scrollBottom + 24 }]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            void load().finally(() => setRefreshing(false));
          }}
        />
      }
    >
      <Text style={styles.hint}>
        Open each item to review lines and totals before validating.
      </Text>

      {hasPermission("ui:validate-documents") ? (
        <>
          <Text style={styles.section}>Pending sales</Text>
          {sales.length === 0 ? (
            <Text style={styles.empty}>No pending invoices.</Text>
          ) : (
            sales.map((s) => (
              <Link key={s.id} href={`/(app)/validation/sale/${s.id}` as never} asChild>
                <Pressable style={styles.card}>
                  <Text style={styles.title}>{s.invoiceNo}</Text>
                  <Text>{s.customerName}</Text>
                  <Text style={styles.meta}>{s.totalLabel}</Text>
                  <Text style={styles.reviewLink}>Review →</Text>
                </Pressable>
              </Link>
            ))
          )}
        </>
      ) : null}

      {hasPermission("route:/delivery-orders/validation-queue") ||
      hasPermission("ui:validate-delivery-orders") ? (
        <>
          <Text style={styles.section}>Delivery orders</Text>
          {dos.length === 0 ? (
            <Text style={styles.empty}>No pending DOs.</Text>
          ) : (
            dos.map((d) => (
              <Link key={d.id} href={`/(app)/validation/do/${d.id}` as never} asChild>
                <Pressable style={styles.card}>
                  <Text style={styles.title}>{d.deliveryOrderNo}</Text>
                  <Text>{d.customerName}</Text>
                  <Text style={styles.meta}>
                    {d.reviewedAtIso ? "Reviewed — ready to validate" : "Awaiting review"}
                  </Text>
                  <Text style={styles.reviewLink}>Review →</Text>
                </Pressable>
              </Link>
            ))
          )}
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  container: { padding: 16, gap: 10 },
  hint: { fontSize: 13, opacity: 0.7, marginBottom: 4 },
  section: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
    color: "#2d5016",
    marginTop: 8,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e2e8e0",
    gap: 4,
  },
  title: { fontWeight: "700", fontSize: 16 },
  meta: { opacity: 0.65, fontSize: 12 },
  reviewLink: { marginTop: 6, color: "#2d5016", fontWeight: "600", fontSize: 14 },
  empty: { opacity: 0.6 },
});
