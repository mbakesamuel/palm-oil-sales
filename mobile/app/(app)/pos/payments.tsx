import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput } from "react-native";
import { useRouter } from "expo-router";
import type { MobilePosTaxPreviewRow } from "@pos/shared";
import { apiFetch } from "@/api/client";
import { useSafePadding } from "@/hooks/use-safe-padding";
import { usePosDraft } from "@/pos-wizard/PosDraftContext";
import { PosField, PosStepTitle, posStyles } from "@/pos-wizard/PosFormParts";

function parseAmount(lines: Array<{ qtyKg?: string; qtyUnits?: string; unitPricePerKg?: string; unitPricePerUnit?: string }>, isBottle: boolean) {
  let net = 0;
  for (const l of lines) {
    const qty = parseFloat(isBottle ? (l.qtyUnits ?? "0") : (l.qtyKg ?? "0"));
    const price = parseFloat(isBottle ? (l.unitPricePerUnit ?? "0") : (l.unitPricePerKg ?? "0"));
    if (Number.isFinite(qty) && Number.isFinite(price)) net += qty * price;
  }
  return net;
}

export default function PosPaymentsScreen() {
  const router = useRouter();
  const { scrollBottom } = useSafePadding();
  const { config, draft, setDraft } = usePosDraft();
  const [error, setError] = useState<string | null>(null);
  const [methodId, setMethodId] = useState(config?.paymentMethods[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [taxes, setTaxes] = useState<MobilePosTaxPreviewRow[]>([]);

  const isBottle = draft.saleProductMode === "BOTTLE";
  const skipTax =
    isBottle ||
    draft.saleDisposition === "RATION" ||
    draft.saleDisposition === "PUBLIC_RELATION";

  const net = useMemo(() => parseAmount(draft.lines, isBottle), [draft.lines, isBottle]);
  const taxTotal = useMemo(
    () => taxes.reduce((s, t) => s + net * parseFloat(t.rate), 0),
    [net, taxes],
  );
  const gross = skipTax ? net : net + taxTotal;
  const paid = draft.payments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
  const remaining = Math.max(0, gross - paid);

  useEffect(() => {
    if (skipTax || !draft.customerId) return;
    void (async () => {
      try {
        const res = await apiFetch<{ ok: boolean; taxes?: MobilePosTaxPreviewRow[] }>(
          "/api/mobile/v1/pos/preview/taxes",
          {
            method: "POST",
            body: JSON.stringify({
              customerId: draft.customerId,
              transactionIso: draft.transactionDate,
            }),
          },
        );
        if (res.ok && res.taxes) setTaxes(res.taxes);
      } catch {
        /* ignore */
      }
    })();
  }, [draft.customerId, draft.transactionDate, skipTax]);

  function onAddPayment() {
    setError(null);
    const val = parseFloat(amount);
    if (!methodId || !Number.isFinite(val) || val <= 0) {
      setError("Enter a valid payment amount.");
      return;
    }
    setDraft({
      payments: [
        ...draft.payments,
        { paymentMethodId: methodId, amount: val.toFixed(2) },
      ],
    });
    setAmount("");
  }

  function onContinue() {
    setError(null);
    if (draft.payments.length === 0) {
      setError("Add at least one payment.");
      return;
    }
    if (Math.abs(paid - gross) > 0.01) {
      setError(`Payment total must equal gross amount (${gross.toFixed(2)} XAF).`);
      return;
    }
    router.push("/(app)/pos/review" as never);
  }

  return (
    <ScrollView
      style={posStyles.screen}
      contentContainerStyle={[posStyles.container, { paddingBottom: scrollBottom + 24 }]}
    >
      <PosStepTitle
        title="Payments"
        subtitle={`Gross due: ${gross.toFixed(2)} XAF · Remaining: ${remaining.toFixed(2)} XAF`}
      />

      {draft.payments.map((p, idx) => {
        const method = config?.paymentMethods.find((m) => m.id === p.paymentMethodId);
        return (
          <Pressable
            key={`${p.paymentMethodId}-${idx}`}
            style={posStyles.card}
            onPress={() =>
              setDraft({ payments: draft.payments.filter((_, i) => i !== idx) })
            }
          >
            <Text style={{ fontWeight: "600" }}>{method?.name ?? "Payment"}</Text>
            <Text>{p.amount} XAF</Text>
            <Text style={{ color: "#b91c1c", marginTop: 4 }}>Tap to remove</Text>
          </Pressable>
        );
      })}

      <PosField label="Payment method">
        {(config?.paymentMethods ?? []).map((m) => (
          <Pressable
            key={m.id}
            style={[posStyles.card, methodId === m.id && { borderColor: "#2d5016" }]}
            onPress={() => setMethodId(m.id)}
          >
            <Text>{m.name}</Text>
          </Pressable>
        ))}
      </PosField>

      <PosField label="Amount (XAF)">
        <TextInput
          style={posStyles.input}
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          placeholder={remaining > 0 ? remaining.toFixed(2) : "0.00"}
        />
      </PosField>

      <Pressable style={posStyles.secondaryBtn} onPress={onAddPayment}>
        <Text style={posStyles.secondaryBtnText}>Add payment</Text>
      </Pressable>

      {error ? <Text style={posStyles.error}>{error}</Text> : null}

      <Pressable style={posStyles.primaryBtn} onPress={onContinue}>
        <Text style={posStyles.primaryBtnText}>Continue to review</Text>
      </Pressable>
    </ScrollView>
  );
}
