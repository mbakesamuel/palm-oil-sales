import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafePadding } from "@/hooks/use-safe-padding";

export function ReviewLoader() {
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color="#2d5016" />
    </View>
  );
}

export function ReviewScroll({
  children,
  footer,
}: {
  children: ReactNode;
  footer?: ReactNode;
}) {
  const { scrollBottom, footerBottom } = useSafePadding();
  return (
    <View style={styles.flex}>
      <ScrollView
        contentContainerStyle={[
          styles.container,
          footer ? { paddingBottom: 16 } : { paddingBottom: scrollBottom + 16 },
        ]}
      >
        {children}
      </ScrollView>
      {footer ? (
        <View style={[styles.footer, { paddingBottom: footerBottom + 16 }]}>
          {footer}
        </View>
      ) : null}
    </View>
  );
}

export function ReviewStatusBadge({ label }: { label: string }) {
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{label}</Text>
    </View>
  );
}

export function ReviewField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{children}</Text>
    </View>
  );
}

export function ReviewSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

export function ReviewLineTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: string[][];
}) {
  return (
    <View style={styles.table}>
      <View style={[styles.tableRow, styles.tableHead]}>
        {headers.map((h) => (
          <Text key={h} style={[styles.tableCell, styles.tableHeadText]}>
            {h}
          </Text>
        ))}
      </View>
      {rows.map((row, i) => (
        <View key={i} style={styles.tableRow}>
          {row.map((cell, j) => (
            <Text key={j} style={styles.tableCell}>
              {cell}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

export function ReviewPrimaryButton({
  label,
  onPress,
  disabled,
  variant = "primary",
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary";
}) {
  return (
    <Pressable
      style={[
        styles.primaryBtn,
        variant === "secondary" && styles.secondaryBtn,
        disabled && styles.btnDisabled,
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text
        style={[
          styles.primaryBtnText,
          variant === "secondary" && styles.secondaryBtnText,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#f8faf8" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  container: { padding: 16, gap: 12, paddingBottom: 24 },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#e2e8e0",
    backgroundColor: "#fff",
    gap: 8,
  },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: "#fef3c7",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeText: { fontSize: 12, fontWeight: "600", color: "#92400e" },
  field: { gap: 2 },
  fieldLabel: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: "#2d5016",
    opacity: 0.8,
  },
  fieldValue: { fontSize: 15 },
  section: { gap: 8, marginTop: 4 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
    color: "#2d5016",
  },
  table: {
    borderWidth: 1,
    borderColor: "#e2e8e0",
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#fff",
  },
  tableRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#e2e8e0" },
  tableHead: { backgroundColor: "#f1f5f0" },
  tableCell: { flex: 1, padding: 8, fontSize: 12 },
  tableHeadText: { fontWeight: "700" },
  primaryBtn: {
    backgroundColor: "#2d5016",
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
  },
  secondaryBtn: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#2d5016",
  },
  primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  secondaryBtnText: { color: "#2d5016", fontWeight: "700", fontSize: 16 },
  btnDisabled: { opacity: 0.5 },
});
