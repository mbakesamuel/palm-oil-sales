import { useCallback, useEffect, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
} from "react-native";
import { Link } from "expo-router";
import type { MobilePendingSaleRow } from "@pos/shared";
import { ApiError, apiFetch } from "@/api/client";
import { useAuth } from "@/auth/AuthProvider";
import {
  canValidateDeliveryOrdersOnMobile,
  canValidateSalesOnMobile,
} from "@/constants/validation-access";
import { ListScreenSkeleton } from "@/components/skeleton";
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
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      if (canValidateSalesOnMobile(hasPermission)) {
        const res = await apiFetch<PendingSalesResponse>(
          "/api/mobile/v1/validation/sales",
        );
        setSales(res.rows);
      }
      if (canValidateDeliveryOrdersOnMobile(hasPermission)) {
        const res = await apiFetch<DoQueueResponse>(
          "/api/mobile/v1/validation/delivery-orders?reviewed=all",
        );
        setDos(res.rows);
      }
    } catch (e) {
      if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
        setLoadError(e.message);
        return;
      }
      setLoadError(
        e instanceof Error ? e.message : "Could not load approval queues.",
      );
    } finally {
      setBusy(false);
    }
  }, [hasPermission]);

  useEffect(() => {
    void load();
  }, [load]);

  if (busy) {
    return <ListScreenSkeleton cards={5} />;
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
        {canValidateDeliveryOrdersOnMobile(hasPermission) &&
        !canValidateSalesOnMobile(hasPermission)
          ? "Managers validate delivery orders only. Open a DO, mark it reviewed, then validate."
          : "Open each item to review lines and totals before validating."}
      </Text>
      {loadError ? <Text style={styles.error}>{loadError}</Text> : null}

      {canValidateSalesOnMobile(hasPermission) ? (
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

      {canValidateDeliveryOrdersOnMobile(hasPermission) ? (
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
  error: { color: "#b91c1c", fontSize: 14, marginBottom: 8 },
});
