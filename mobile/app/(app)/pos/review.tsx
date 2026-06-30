import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, Text } from "react-native";
import { useRouter } from "expo-router";
import type { MobileCreateSaleResponse, MobilePosTaxPreviewRow } from "@pos/shared";
import { apiFetch } from "@/api/client";
import {
  ReviewField,
  ReviewLoader,
  ReviewPrimaryButton,
  ReviewScroll,
  ReviewSection,
} from "@/components/approval-review";
import {
  skipDeliveryOrder,
  skipPayments,
  usePosDraft,
  usesTypedCustomerName,
} from "@/pos-wizard/PosDraftContext";
import { posStyles } from "@/pos-wizard/PosFormParts";

function lineGross(
  line: {
    qtyKg?: string;
    qtyUnits?: string;
    unitPricePerKg?: string;
    unitPricePerUnit?: string;
  },
  isBottle: boolean,
) {
  const qty = parseFloat(isBottle ? (line.qtyUnits ?? "0") : (line.qtyKg ?? "0"));
  const price = parseFloat(isBottle ? (line.unitPricePerUnit ?? "0") : (line.unitPricePerKg ?? "0"));
  return Number.isFinite(qty) && Number.isFinite(price) ? qty * price : 0;
}

export default function PosReviewScreen() {
  const router = useRouter();
  const { config, draft, toCreateRequest, resetDraft } = usePosDraft();
  const [taxes, setTaxes] = useState<MobilePosTaxPreviewRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [loadingTax, setLoadingTax] = useState(true);

  const isBottle = draft.saleProductMode === "BOTTLE";
  const skipTax =
    isBottle ||
    draft.saleDisposition === "RATION" ||
    draft.saleDisposition === "PUBLIC_RELATION";

  const net = useMemo(
    () => draft.lines.reduce((s, l) => s + lineGross(l, isBottle), 0),
    [draft.lines, isBottle],
  );

  const taxTotal = useMemo(() => {
    return taxes.reduce((s, t) => s + net * parseFloat(t.rate), 0);
  }, [net, taxes]);

  const gross = skipTax ? net : net + taxTotal;

  const customerLabel = usesTypedCustomerName(draft.saleDisposition)
    ? draft.typedCustomerName
    : draft.useWalkInCustomer
      ? draft.walkInCustomerName
      : draft.customerName;

  useEffect(() => {
    if (skipTax || !draft.customerId) {
      setLoadingTax(false);
      return;
    }
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
      } finally {
        setLoadingTax(false);
      }
    })();
  }, [draft.customerId, draft.transactionDate, skipTax]);

  async function onSubmit() {
    setBusy(true);
    try {
      const result = await apiFetch<MobileCreateSaleResponse>(
        "/api/mobile/v1/pos/sales",
        {
          method: "POST",
          body: JSON.stringify(toCreateRequest()),
        },
      );
      if (!result.ok) {
        Alert.alert(
          "Could not save",
          result.error +
            (result.invoiceNo
              ? `\n\nInvoice ${result.invoiceNo} was created but not validated. Check Approvals inbox.`
              : ""),
        );
        return;
      }
      Alert.alert("Validated", `Invoice ${result.invoiceNo} saved and validated.`, [
        {
          text: "OK",
          onPress: () => {
            resetDraft();
            router.replace("/(app)" as never);
          },
        },
      ]);
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Could not save sale.");
    } finally {
      setBusy(false);
    }
  }

  if (loadingTax) return <ReviewLoader />;

  const products = isBottle
    ? (config?.bottledProducts ?? [])
    : (config?.looseProducts ?? []);

  function productName(id: string) {
    return products.find((p) => String(p.productId) === id)?.productName ?? id;
  }

  return (
    <ReviewScroll
      footer={
        <ReviewPrimaryButton
          label="Save & validate"
          onPress={() => void onSubmit()}
          loading={busy}
        />
      }
    >
      <Text style={{ fontSize: 20, fontWeight: "700" }}>Review sale</Text>

      <ReviewField label="Mode">
        {draft.saleProductMode} · {draft.saleDisposition}
      </ReviewField>
      <ReviewField label="Customer">{customerLabel || "—"}</ReviewField>
      <ReviewField label="Date">{draft.transactionDate}</ReviewField>
      {!isBottle ? (
        <ReviewField label="Vehicle">{draft.vehicleNumber || "—"}</ReviewField>
      ) : null}
      {!skipDeliveryOrder(draft.saleProductMode, draft.saleDisposition) ? (
        <ReviewField label="Delivery order">{draft.deliveryOrderNo || "—"}</ReviewField>
      ) : null}

      <ReviewSection title="Lines">
        {draft.lines.map((l, i) => (
          <Text key={`${l.productId}-${i}`} style={{ marginBottom: 6 }}>
            {productName(l.productId)} —{" "}
            {isBottle ? `${l.qtyUnits} units` : `${l.qtyKg} kg`} ·{" "}
            {lineGross(l, isBottle).toFixed(2)} XAF net
          </Text>
        ))}
      </ReviewSection>

      {!skipTax && taxes.length > 0 ? (
        <ReviewSection title="Taxes">
          {taxes.map((t) => (
            <Text key={t.code} style={{ marginBottom: 4 }}>
              {t.label} ({t.ratePercentLabel}%) — {(net * parseFloat(t.rate)).toFixed(2)} XAF
            </Text>
          ))}
        </ReviewSection>
      ) : null}

      {!skipPayments(draft.saleDisposition) ? (
        <ReviewSection title="Payments">
          {draft.payments.map((p, i) => {
            const method = config?.paymentMethods.find((m) => m.id === p.paymentMethodId);
            return (
              <Text key={`${p.paymentMethodId}-${i}`} style={{ marginBottom: 4 }}>
                {method?.name ?? "Payment"} — {p.amount} XAF
              </Text>
            );
          })}
        </ReviewSection>
      ) : null}

      <ReviewField label="Gross total">{gross.toFixed(2)} XAF</ReviewField>
      <Text style={posStyles.hint}>
        Saving will post stock and validate this invoice immediately.
      </Text>
    </ReviewScroll>
  );
}
