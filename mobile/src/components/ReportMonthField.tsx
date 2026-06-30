import { useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { colors } from "@/components/report-ui";

export type SelectableMonthOption = {
  year: number;
  month: number;
  label: string;
};

function monthToDate(year: number, month: number): Date {
  return new Date(year, month - 1, 1);
}

function formatMonthLabel(year: number, month: number): string {
  return monthToDate(year, month).toLocaleString("en-GB", {
    month: "short",
    year: "numeric",
  });
}

function boundsFromSelectable(months: SelectableMonthOption[]): {
  minDate?: Date;
  maxDate?: Date;
} {
  if (months.length === 0) return {};
  const first = months[0]!;
  const last = months[months.length - 1]!;
  return {
    minDate: monthToDate(first.year, first.month),
    maxDate: monthToDate(last.year, last.month),
  };
}

function isSelectable(
  months: SelectableMonthOption[],
  year: number,
  month: number,
): boolean {
  return months.some((m) => m.year === year && m.month === month);
}

export function ReportMonthField({
  label,
  year,
  month,
  selectableMonths,
  disabled,
  hint,
  onChange,
}: {
  label: string;
  year: number | null;
  month: number | null;
  selectableMonths: SelectableMonthOption[];
  disabled?: boolean;
  hint?: string;
  onChange: (year: number, month: number) => void;
}) {
  const [showPicker, setShowPicker] = useState(false);
  const displayLabel =
    year != null && month != null ? formatMonthLabel(year, month) : "Tap to choose month";

  const { minDate, maxDate } = boundsFromSelectable(selectableMonths);
  const selected =
    year != null && month != null
      ? monthToDate(year, month)
      : (maxDate ?? minDate ?? new Date());

  function onPickerChange(event: DateTimePickerEvent, date?: Date) {
    if (Platform.OS === "android") {
      setShowPicker(false);
    }
    if (event.type === "dismissed" || !date) return;
    const pickedYear = date.getFullYear();
    const pickedMonth = date.getMonth() + 1;
    if (!isSelectable(selectableMonths, pickedYear, pickedMonth)) return;
    onChange(pickedYear, pickedMonth);
    if (Platform.OS === "ios") {
      setShowPicker(false);
    }
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        style={[styles.input, disabled && styles.inputDisabled]}
        onPress={() => !disabled && setShowPicker(true)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${displayLabel}`}
      >
        <Text style={[styles.value, !year && styles.placeholder]}>{displayLabel}</Text>
      </Pressable>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      {showPicker ? (
        <DateTimePicker
          value={selected}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          minimumDate={minDate}
          maximumDate={maxDate}
          onChange={onPickerChange}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    color: colors.muted,
  },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  inputDisabled: { opacity: 0.5 },
  value: { fontSize: 16, color: "#111", fontWeight: "600" },
  placeholder: { color: colors.muted, fontWeight: "400" },
  hint: { fontSize: 12, color: colors.muted },
});
