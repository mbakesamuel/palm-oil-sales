import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, Text, TextInput } from "react-native";
import { useRouter } from "expo-router";
import type { MobilePosDeliveryOrderRow } from "@pos/shared";
import { apiFetch } from "@/api/client";
import { useSafePadding } from "@/hooks/use-safe-padding";
import { usePosDraft } from "@/pos-wizard/PosDraftContext";
import { PosField, PosStepTitle, posStyles } from "@/pos-wizard/PosFormParts";

export default function PosDeliveryOrderScreen() {
  const router = useRouter();
  const { scrollBottom } = useSafePadding();
  const { config, draft, setDraft } = usePosDraft();
  const [rows, setRows] = useState<MobilePosDeliveryOrderRow[]>([]);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const salesPointId = config?.effectiveSalesPointId;

  const load = useCallback(async () => {
    if (!salesPointId) return;
    const res = await apiFetch<{ rows: MobilePosDeliveryOrderRow[] }>(
      `/api/mobile/v1/pos/delivery-orders?salesPointId=${salesPointId}`,
    );
    setRows(res.rows);
  }, [salesPointId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onLookup() {
    setLookupError(null);
    if (!draft.deliveryOrderNo.trim()) return;
    try {
      const res = await apiFetch<{
        ok: boolean;
        data?: { customerMatches: boolean; customerName: string };
        error?: string;
      }>(
        `/api/mobile/v1/pos/delivery-orders/lookup?no=${encodeURIComponent(draft.deliveryOrderNo)}&customerId=${encodeURIComponent(draft.customerId)}`,
      );
      if (!res.ok || !res.data) {
        setLookupError("Delivery order not found.");
        return;
      }
      if (!res.data.customerMatches) {
        setLookupError("Delivery order customer does not match selected customer.");
      }
    } catch (e) {
      setLookupError(e instanceof Error ? e.message : "Lookup failed.");
    }
  }

  function onContinue() {
    setError(null);
    if (!draft.deliveryOrderNo.trim()) {
      setError("Delivery order number is required.");
      return;
    }
    router.push("/(app)/pos/lines" as never);
  }

  return (
    <ScrollView
      style={posStyles.screen}
      contentContainerStyle={[posStyles.container, { paddingBottom: scrollBottom + 24 }]}
    >
      <PosStepTitle
        title="Delivery order"
        subtitle="Link this sale to a validated delivery order with remaining balance."
      />

      <PosField label="D.O. number">
        <TextInput
          style={posStyles.input}
          value={draft.deliveryOrderNo}
          onChangeText={(v) => setDraft({ deliveryOrderNo: v })}
          placeholder="Enter or pick below"
          autoCapitalize="characters"
          onBlur={() => void onLookup()}
        />
      </PosField>
      {lookupError ? <Text style={posStyles.error}>{lookupError}</Text> : null}

      <Text style={posStyles.hint}>Available delivery orders</Text>
      {rows.map((r) => (
        <Pressable
          key={r.deliveryOrderNo}
          style={[
            posStyles.card,
            draft.deliveryOrderNo === r.deliveryOrderNo && { borderColor: "#2d5016" },
          ]}
          onPress={() => setDraft({ deliveryOrderNo: r.deliveryOrderNo })}
        >
          <Text style={{ fontWeight: "700" }}>{r.deliveryOrderNo}</Text>
          <Text>{r.customerName}</Text>
          <Text style={posStyles.hint}>
            {r.dateIssued} · balance {r.balanceKg} kg
          </Text>
        </Pressable>
      ))}

      {error ? <Text style={posStyles.error}>{error}</Text> : null}

      <Pressable style={posStyles.primaryBtn} onPress={onContinue}>
        <Text style={posStyles.primaryBtnText}>Continue</Text>
      </Pressable>
    </ScrollView>
  );
}
