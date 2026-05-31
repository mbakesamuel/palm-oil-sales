import type { ReactNode } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

export const colors = {
  brand: "#2d5016",
  border: "#e2e8e0",
  card: "#ffffff",
  muted: "#64748b",
  error: "#b91c1c",
  warnBg: "#fef2f2",
  warnBorder: "#fca5a5",
};

export function ReportLoader() {
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={colors.brand} />
    </View>
  );
}

export function ReportScroll(props: {
  children: ReactNode;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={props.refreshing}
          onRefresh={props.onRefresh}
          tintColor={colors.brand}
        />
      }
    >
      {props.children}
    </ScrollView>
  );
}

export function SectionTitle(props: { children: string }) {
  return <Text style={styles.section}>{props.children}</Text>;
}

export function SummaryCard(props: {
  label: string;
  value: string;
  hint?: string;
  highlight?: boolean;
}) {
  return (
    <View style={[styles.card, props.highlight && styles.cardWarn]}>
      <Text style={styles.cardLabel}>{props.label}</Text>
      <Text style={styles.cardValue}>{props.value}</Text>
      {props.hint ? <Text style={styles.cardHint}>{props.hint}</Text> : null}
    </View>
  );
}

export function EmptyState(props: { message: string }) {
  return <Text style={styles.empty}>{props.message}</Text>;
}

export function ErrorBanner(props: { message: string }) {
  return <Text style={styles.error}>{props.message}</Text>;
}

export function MetaText(props: { children: ReactNode }) {
  return <Text style={styles.meta}>{props.children}</Text>;
}

export function DataTable(props: {
  columns: Array<{ key: string; label: string; align?: "left" | "right" }>;
  rows: Array<Record<string, string>>;
  emptyMessage?: string;
}) {
  if (props.rows.length === 0) {
    return <EmptyState message={props.emptyMessage ?? "No rows."} />;
  }

  return (
    <View style={styles.table}>
      <View style={[styles.tableRow, styles.tableHead]}>
        {props.columns.map((col) => (
          <Text
            key={col.key}
            style={[
              styles.tableCell,
              styles.tableHeadText,
              col.align === "right" && styles.alignRight,
              props.columns.length > 2 && styles.tableCellFlex,
            ]}
          >
            {col.label}
          </Text>
        ))}
      </View>
      {props.rows.map((row, idx) => (
        <View key={`${idx}-${row[props.columns[0]?.key] ?? idx}`} style={styles.tableRow}>
          {props.columns.map((col) => (
            <Text
              key={col.key}
              style={[
                styles.tableCell,
                col.align === "right" && styles.alignRight,
                props.columns.length > 2 && styles.tableCellFlex,
              ]}
              numberOfLines={2}
            >
              {row[col.key] ?? ""}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

export function ListCard(props: {
  title: string;
  subtitle?: string;
  meta?: string;
  right?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.listCard, props.style]}>
      <View style={styles.listCardMain}>
        <Text style={styles.listTitle}>{props.title}</Text>
        {props.subtitle ? <Text style={styles.listSubtitle}>{props.subtitle}</Text> : null}
        {props.meta ? <Text style={styles.listMeta}>{props.meta}</Text> : null}
      </View>
      {props.right ? (
        <Text style={styles.listRight} numberOfLines={2}>
          {props.right}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  container: { padding: 16, gap: 10, paddingBottom: 32 },
  section: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginTop: 8,
    color: colors.brand,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardWarn: { borderColor: colors.warnBorder, backgroundColor: colors.warnBg },
  cardLabel: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    color: colors.muted,
  },
  cardValue: { fontSize: 18, fontWeight: "700", marginTop: 4, color: "#111" },
  cardHint: { fontSize: 11, color: colors.muted, marginTop: 4 },
  empty: { fontSize: 14, color: colors.muted, paddingVertical: 8 },
  error: { color: colors.error, marginBottom: 8 },
  meta: { fontSize: 12, color: colors.muted, marginBottom: 4 },
  table: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: colors.card,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  tableHead: { backgroundColor: "#f4f7f2" },
  tableHeadText: { fontWeight: "700", fontSize: 11, textTransform: "uppercase" },
  tableCell: { fontSize: 13, color: "#111", flex: 1 },
  tableCellFlex: { flex: 1 },
  alignRight: { textAlign: "right" },
  listCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  listCardMain: { flex: 1, gap: 2 },
  listTitle: { fontSize: 15, fontWeight: "700", color: "#111" },
  listSubtitle: { fontSize: 14, color: "#333" },
  listMeta: { fontSize: 12, color: colors.muted },
  listRight: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.brand,
    textAlign: "right",
    maxWidth: "38%",
  },
});
