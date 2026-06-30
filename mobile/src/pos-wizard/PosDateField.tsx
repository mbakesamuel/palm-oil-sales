import { useState } from "react";
import { Platform, Pressable, Text } from "react-native";
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { PosField, posStyles } from "@/pos-wizard/PosFormParts";

function parseIsoDate(iso: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m, d] = iso.split("-").map((part) => Number.parseInt(part, 10));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  return new Date(y, m - 1, d);
}

function formatIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function PosDateField({
  label,
  value,
  onChange,
  minIso,
  maxIso,
  hint,
}: {
  label: string;
  value: string;
  onChange: (iso: string) => void;
  minIso?: string | null;
  maxIso?: string | null;
  hint?: string;
}) {
  const [showPicker, setShowPicker] = useState(false);
  const selected = parseIsoDate(value) ?? parseIsoDate(maxIso ?? "") ?? new Date();
  const minimumDate = minIso ? (parseIsoDate(minIso) ?? undefined) : undefined;
  const maximumDate = maxIso ? (parseIsoDate(maxIso) ?? undefined) : undefined;

  function onPickerChange(event: DateTimePickerEvent, date?: Date) {
    if (Platform.OS === "android") {
      setShowPicker(false);
    }
    if (event.type === "dismissed" || !date) return;
    onChange(formatIsoDate(date));
    if (Platform.OS === "ios") {
      setShowPicker(false);
    }
  }

  return (
    <PosField label={label}>
      <Pressable
        style={[posStyles.input, { justifyContent: "center" }]}
        onPress={() => setShowPicker(true)}
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${value || "not set"}`}
      >
        <Text style={{ fontSize: 16, color: value ? "#1a2e14" : "#8a9682" }}>
          {value || "Tap to choose date"}
        </Text>
      </Pressable>
      {hint ? <Text style={posStyles.hint}>{hint}</Text> : null}
      {showPicker ? (
        <DateTimePicker
          value={selected}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          onChange={onPickerChange}
        />
      ) : null}
    </PosField>
  );
}
