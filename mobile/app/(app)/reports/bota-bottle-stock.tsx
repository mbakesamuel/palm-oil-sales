import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  DataTable,
  ErrorBanner,
  MetaText,
  ReportLoader,
  ReportScroll,
  SectionTitle,
  SummaryCard,
} from "@/components/report-ui";
import { useReportLoad } from "@/hooks/useReportLoad";
import { agro } from "@/theme/agro";

type BotaBottleStockData = {
  botaSalesPointName: string;
  selectedProductId: string;
  productInvalid: boolean;
  productOptions: Array<{ value: string; label: string }>;
  rows: Array<{
    id: string;
    occurredAtIso: string;
    productName: string;
    uom: string;
    storageLocationName: string;
    kindLabel: string;
    inQty: string | null;
    outQty: string | null;
    balanceQty: string;
    documentNo: string | null;
    userName: string;
  }>;
  summary: {
    totalIn: string;
    totalOut: string;
    balance: string;
    uom: string;
    movementCount: number;
  };
  showProductColumn: boolean;
  truncated: boolean;
};

function fmtQty(qty: string, uom: string): string {
  const n = Number(qty);
  if (!Number.isFinite(n)) return `${qty} ${uom}`;
  return `${n.toLocaleString("fr-FR", { maximumFractionDigits: 3 })} ${uom}`;
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export default function BotaBottleStockScreen() {
  const [productId, setProductId] = useState("");
  const path = useMemo(() => {
    const base = "/api/mobile/v1/reports/bota-bottle-stock";
    if (!productId) return base;
    return `${base}?productId=${encodeURIComponent(productId)}`;
  }, [productId]);

  const { data, error, loading, refreshing, refresh } =
    useReportLoad<BotaBottleStockData>(path);

  if (loading && !data && !error) return <ReportLoader />;

  return (
    <ReportScroll refreshing={refreshing} onRefresh={() => void refresh()}>
      {error ? <ErrorBanner message={error} /> : null}
      {data ? (
        <>
          <MetaText>
            {data.botaSalesPointName} · bottled palm oil · {data.summary.movementCount}{" "}
            movement{data.summary.movementCount === 1 ? "" : "s"}
            {data.truncated ? " (latest slice shown)" : ""}
          </MetaText>

          <SectionTitle>Product</SectionTitle>
          <View style={styles.chipRow}>
            <FilterChip
              label="All bottled"
              active={productId === ""}
              onPress={() => setProductId("")}
            />
            {data.productOptions.map((opt) => (
              <FilterChip
                key={opt.value}
                label={opt.label}
                active={productId === opt.value}
                onPress={() => setProductId(opt.value)}
              />
            ))}
          </View>

          {data.productInvalid ? (
            <ErrorBanner message="Invalid product filter. Choose another product." />
          ) : (
            <>
              <SectionTitle>Summary</SectionTitle>
              <SummaryCard
                label="Total IN"
                value={fmtQty(data.summary.totalIn, data.summary.uom)}
              />
              <SummaryCard
                label="Total OUT"
                value={fmtQty(data.summary.totalOut, data.summary.uom)}
              />
              <SummaryCard
                label="Current balance"
                value={fmtQty(data.summary.balance, data.summary.uom)}
                hint="Live on-hand at Bota"
              />

              <SectionTitle>Movement history</SectionTitle>
              <DataTable
                columns={[
                  { key: "date", label: "Date" },
                  ...(data.showProductColumn
                    ? [{ key: "product", label: "Product" }]
                    : []),
                  { key: "kind", label: "Type" },
                  { key: "in", label: "IN", align: "right" as const },
                  { key: "out", label: "OUT", align: "right" as const },
                  { key: "balance", label: "Bal.", align: "right" as const },
                ]}
                rows={data.rows.map((r) => ({
                  date: formatDateTime(r.occurredAtIso),
                  ...(data.showProductColumn ? { product: r.productName } : {}),
                  kind: r.kindLabel,
                  in: r.inQty != null ? fmtQty(r.inQty, r.uom) : "—",
                  out: r.outQty != null ? fmtQty(r.outQty, r.uom) : "—",
                  balance: fmtQty(r.balanceQty, r.uom),
                }))}
                emptyMessage="No bottle stock movements at Bota yet."
              />
            </>
          )}
        </>
      ) : null}
    </ReportScroll>
  );
}

function FilterChip(props: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={props.onPress}
      style={[styles.chip, props.active && styles.chipActive]}
    >
      <Text style={[styles.chipText, props.active && styles.chipTextActive]}>
        {props.label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderColor: agro.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: agro.panel,
  },
  chipActive: {
    borderColor: agro.forest,
    backgroundColor: "#e8f0e4",
  },
  chipText: {
    fontSize: 13,
    color: agro.textMuted,
  },
  chipTextActive: {
    color: agro.forest,
    fontWeight: "700",
  },
});
