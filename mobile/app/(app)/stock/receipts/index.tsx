import { useCallback, useEffect, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
} from "react-native";
import { Link } from "expo-router";
import type { MobileReceiptListRow } from "@pos/shared";
import { apiFetch } from "@/api/client";
import { ListScreenSkeleton } from "@/components/skeleton";
import { useSafePadding } from "@/hooks/use-safe-padding";

type ReceiptsResponse = { rows: MobileReceiptListRow[] };

export default function StockReceiptsScreen() {
  const { scrollBottom } = useSafePadding();
  const [rows, setRows] = useState<MobileReceiptListRow[]>([]);
  const [busy, setBusy] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch<ReceiptsResponse>("/api/mobile/v1/stock/receipts");
      setRows(res.rows);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (busy) {
    return <ListScreenSkeleton cards={4} />;
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
        Open each draft to check lines against the clerk voucher, then post.
      </Text>
      {rows.length === 0 ? (
        <Text style={styles.empty}>No draft receipts at your sales point.</Text>
      ) : (
        rows.map((r) => (
          <Link key={r.id} href={`/(app)/stock/receipts/${r.id}` as never} asChild>
            <Pressable style={styles.card}>
              <Text style={styles.title}>{r.receiptNo}</Text>
              <Text>{r.supplierLabel}</Text>
              <Text style={styles.meta}>
                {r.lineCount} line{r.lineCount === 1 ? "" : "s"} · {r.totalQty} · by{" "}
                {r.createdByName}
              </Text>
              <Text style={styles.reviewLink}>Review →</Text>
            </Pressable>
          </Link>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 10 },
  hint: { fontSize: 13, opacity: 0.7, marginBottom: 4 },
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
