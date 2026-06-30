import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { agro } from "@/theme/agro";

export function PosStepTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

export function PosChoiceButton({
  label,
  selected,
  onPress,
  description,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  description?: string;
}) {
  return (
    <Pressable
      style={[styles.choice, selected && styles.choiceSelected]}
      onPress={onPress}
    >
      <Text style={[styles.choiceLabel, selected && styles.choiceLabelSelected]}>
        {label}
      </Text>
      {description ? (
        <Text style={[styles.choiceDesc, selected && styles.choiceDescSelected]}>
          {description}
        </Text>
      ) : null}
    </Pressable>
  );
}

export function PosField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

export const posStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: agro.canvas },
  container: { padding: 16, gap: 12 },
  input: {
    backgroundColor: agro.panel,
    borderWidth: 1,
    borderColor: agro.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: agro.text,
  },
  primaryBtn: {
    backgroundColor: agro.forest,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  secondaryBtn: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: agro.border,
    backgroundColor: agro.panel,
  },
  secondaryBtnText: { color: agro.forest, fontWeight: "600", fontSize: 15 },
  error: { color: agro.danger, fontSize: 14 },
  hint: { color: agro.textMuted, fontSize: 13 },
  card: {
    backgroundColor: agro.panel,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: agro.borderLight,
    gap: 6,
  },
  row: { flexDirection: "row", gap: 8, alignItems: "center" },
  segmentRow: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: agro.border,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: agro.panel,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: "center",
  },
  segmentBtnActive: {
    backgroundColor: agro.forest,
  },
  segmentLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: agro.text,
    textAlign: "center",
  },
  segmentLabelActive: {
    color: "#fff",
  },
});

const styles = StyleSheet.create({
  wrap: { gap: 4, marginBottom: 4 },
  title: { fontSize: 20, fontWeight: "700", color: agro.text },
  subtitle: { fontSize: 14, color: agro.textMuted },
  choice: {
    backgroundColor: agro.panel,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: agro.borderLight,
    gap: 4,
  },
  choiceSelected: {
    borderColor: agro.forest,
    backgroundColor: "#eef5ea",
  },
  choiceLabel: { fontSize: 16, fontWeight: "600", color: agro.text },
  choiceLabelSelected: { color: agro.forest },
  choiceDesc: { fontSize: 13, color: agro.textMuted },
  choiceDescSelected: { color: agro.leaf },
  field: { gap: 6 },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: agro.textMuted,
  },
});
