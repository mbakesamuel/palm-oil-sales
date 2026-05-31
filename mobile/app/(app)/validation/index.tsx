import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { MobilePendingSaleRow } from "@pos/shared";
import { apiFetch } from "@/api/client";
import { useAuth } from "@/auth/AuthProvider";

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
  const [sales, setSales] = useState<MobilePendingSaleRow[]>([]);
  const [dos, setDos] = useState<DoQueueResponse["rows"]>([]);
  const [busy, setBusy] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      if (hasPermission("route:/pos")) {
        const res = await apiFetch<PendingSalesResponse>(
          "/api/mobile/v1/validation/sales",
        );
        setSales(res.rows);
      }
      if (hasPermission("route:/delivery-orders/validation-queue")) {
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

  async function validateSale(id: string, invoiceNo: string) {
    try {
      await apiFetch(`/api/mobile/v1/validation/sales/${id}/validate`, {
        method: "POST",
      });
      Alert.alert("Validated", `Invoice ${invoiceNo} validated.`);
      await load();
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Validation failed.");
    }
  }

  async function markDoReviewed(id: number) {
    try {
      await apiFetch("/api/mobile/v1/validation/delivery-orders/mark-reviewed", {
        method: "POST",
        body: JSON.stringify({ ids: [id] }),
      });
      await load();
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed.");
    }
  }

  async function validateDo(id: number, doNo: string) {
    try {
      const res = await apiFetch<{ validated: number; errors: Array<{ error: string }> }>(
        "/api/mobile/v1/validation/delivery-orders/validate-reviewed",
        { method: "POST", body: JSON.stringify({ ids: [id] }) },
      );
      if (res.validated > 0) {
        Alert.alert("Validated", `DO ${doNo} validated.`);
      } else if (res.errors[0]) {
        Alert.alert("Error", res.errors[0].error);
      }
      await load();
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed.");
    }
  }

  if (busy) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2d5016" />
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
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
      {hasPermission("ui:validate-documents") ? (
        <>
          <Text style={styles.section}>Pending sales</Text>
          {sales.length === 0 ? (
            <Text style={styles.empty}>No pending invoices.</Text>
          ) : (
            sales.map((s) => (
              <View key={s.id} style={styles.card}>
                <Text style={styles.title}>{s.invoiceNo}</Text>
                <Text>{s.customerName}</Text>
                <Text style={styles.meta}>{s.totalLabel}</Text>
                <Pressable
                  style={styles.action}
                  onPress={() => void validateSale(s.id, s.invoiceNo)}
                >
                  <Text style={styles.actionText}>Validate</Text>
                </Pressable>
              </View>
            ))
          )}
        </>
      ) : null}

      {hasPermission("route:/delivery-orders/validation-queue") ? (
        <>
          <Text style={styles.section}>Delivery orders</Text>
          {dos.length === 0 ? (
            <Text style={styles.empty}>No pending DOs.</Text>
          ) : (
            dos.map((d) => (
              <View key={d.id} style={styles.card}>
                <Text style={styles.title}>{d.deliveryOrderNo}</Text>
                <Text>{d.customerName}</Text>
                <Text style={styles.meta}>
                  {d.reviewedAtIso ? "Reviewed" : "Awaiting review"}
                </Text>
                {!d.reviewedAtIso ? (
                  <Pressable
                    style={styles.action}
                    onPress={() => void markDoReviewed(d.id)}
                  >
                    <Text style={styles.actionText}>Mark reviewed</Text>
                  </Pressable>
                ) : (
                  <Pressable
                    style={styles.action}
                    onPress={() => void validateDo(d.id, d.deliveryOrderNo)}
                  >
                    <Text style={styles.actionText}>Validate</Text>
                  </Pressable>
                )}
              </View>
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
  empty: { opacity: 0.6 },
  action: {
    marginTop: 8,
    backgroundColor: "#2d5016",
    borderRadius: 8,
    padding: 10,
    alignItems: "center",
  },
  actionText: { color: "#fff", fontWeight: "600" },
});
