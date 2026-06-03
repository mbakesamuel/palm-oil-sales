import { useCallback, useEffect, useState } from "react";
import { Alert, Text } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { MobileSaleDetail } from "@pos/shared";
import { apiFetch } from "@/api/client";
import {
  ReviewField,
  ReviewLineTable,
  ReviewLoader,
  ReviewPrimaryButton,
  ReviewScroll,
  ReviewSection,
  ReviewStatusBadge,
} from "@/components/approval-review";

export default function SaleReviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [detail, setDetail] = useState<MobileSaleDetail | null>(null);
  const [busy, setBusy] = useState(true);
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const res = await apiFetch<{ detail: MobileSaleDetail }>(
        `/api/mobile/v1/validation/sales/${id}`,
      );
      setDetail(res.detail);
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Could not load sale.");
      router.back();
    } finally {
      setBusy(false);
    }
  }, [id, router]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onValidate() {
    if (!detail) return;
    Alert.alert(
      "Validate invoice",
      `Post stock and validate ${detail.invoiceNo}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Validate",
          onPress: () => {
            void (async () => {
              setActing(true);
              try {
                await apiFetch(`/api/mobile/v1/validation/sales/${detail.id}/validate`, {
                  method: "POST",
                });
                Alert.alert("Validated", `${detail.invoiceNo} validated.`, [
                  { text: "OK", onPress: () => router.back() },
                ]);
              } catch (e) {
                Alert.alert(
                  "Error",
                  e instanceof Error ? e.message : "Validation failed.",
                );
              } finally {
                setActing(false);
              }
            })();
          },
        },
      ],
    );
  }

  if (busy || !detail) return <ReviewLoader />;

  const canValidate = detail.status === "PENDING";

  return (
    <ReviewScroll
      footer={
        canValidate ? (
          <ReviewPrimaryButton
            label="Validate invoice"
            onPress={() => void onValidate()}
            loading={acting}
          />
        ) : null
      }
    >
      <ReviewStatusBadge label={detail.status} />
      <Text style={{ fontSize: 20, fontWeight: "700" }}>{detail.invoiceNo}</Text>

      <ReviewField label="Customer">{detail.customerName}</ReviewField>
      <ReviewField label="Sales point">{detail.salesPointName ?? "—"}</ReviewField>
      <ReviewField label="Sold on">{detail.soldAtIso}</ReviewField>
      <ReviewField label="Delivery order">{detail.deliveryOrderNo ?? "—"}</ReviewField>
      <ReviewField label="Vehicle">{detail.vehicleNumber || "—"}</ReviewField>
      <ReviewField label="Prepared by">{detail.createdByName}</ReviewField>
      <ReviewField label="Gross total">{detail.grossAmount} XAF</ReviewField>

      <ReviewSection title="Line items">
        <ReviewLineTable
          headers={["Product", "Qty", "Price", "Gross"]}
          rows={detail.lines.map((l) => [
            l.productName,
            l.qtyLabel,
            l.unitPriceLabel,
            l.lineGross,
          ])}
        />
      </ReviewSection>

      {detail.payments.length > 0 ? (
        <ReviewSection title="Payments">
          <ReviewLineTable
            headers={["Method", "Amount", "Ref"]}
            rows={detail.payments.map((p) => [
              p.method,
              p.amount,
              p.reference ?? "—",
            ])}
          />
        </ReviewSection>
      ) : null}
    </ReviewScroll>
  );
}
