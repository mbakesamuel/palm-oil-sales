import { useCallback, useEffect, useState } from "react";
import { Alert, Text } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { MobileDeliveryOrderDetail } from "@pos/shared";
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

export default function DeliveryOrderReviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [detail, setDetail] = useState<MobileDeliveryOrderDetail | null>(null);
  const [busy, setBusy] = useState(true);
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const res = await apiFetch<{ detail: MobileDeliveryOrderDetail }>(
        `/api/mobile/v1/validation/delivery-orders/${id}`,
      );
      setDetail(res.detail);
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Could not load DO.");
      router.back();
    } finally {
      setBusy(false);
    }
  }, [id, router]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onMarkReviewed() {
    if (!detail) return;
    setActing(true);
    try {
      await apiFetch("/api/mobile/v1/validation/delivery-orders/mark-reviewed", {
        method: "POST",
        body: JSON.stringify({ ids: [detail.id] }),
      });
      await load();
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed.");
    } finally {
      setActing(false);
    }
  }

  async function onValidate() {
    if (!detail) return;
    Alert.alert(
      "Validate delivery order",
      `Validate ${detail.deliveryOrderNo}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Validate",
          onPress: () => {
            void (async () => {
              setActing(true);
              try {
                const res = await apiFetch<{
                  validated: number;
                  errors: Array<{ error: string }>;
                }>("/api/mobile/v1/validation/delivery-orders/validate-reviewed", {
                  method: "POST",
                  body: JSON.stringify({ ids: [detail.id] }),
                });
                if (res.validated > 0) {
                  Alert.alert("Validated", `${detail.deliveryOrderNo} validated.`, [
                    { text: "OK", onPress: () => router.back() },
                  ]);
                } else if (res.errors[0]) {
                  Alert.alert("Error", res.errors[0].error);
                } else {
                  Alert.alert(
                    "Not validated",
                    "Mark the delivery order as reviewed first, then try again.",
                  );
                }
              } catch (e) {
                Alert.alert("Error", e instanceof Error ? e.message : "Failed.");
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

  const reviewed = detail.reviewedAtIso != null;
  const canValidate = detail.status === "PENDING" && reviewed;

  return (
    <ReviewScroll
      footer={
        detail.status === "PENDING" ? (
          reviewed ? (
            <ReviewPrimaryButton
              label="Validate delivery order"
              onPress={() => void onValidate()}
              loading={acting}
            />
          ) : (
            <ReviewPrimaryButton
              label="Mark as reviewed"
              onPress={() => void onMarkReviewed()}
              loading={acting}
              variant="secondary"
            />
          )
        ) : null
      }
    >
      <ReviewStatusBadge label={reviewed ? "Reviewed · pending validation" : "Awaiting review"} />
      <Text style={{ fontSize: 20, fontWeight: "700" }}>{detail.deliveryOrderNo}</Text>

      <ReviewField label="Customer">{detail.customerName}</ReviewField>
      <ReviewField label="Sales point">{detail.salesPointName}</ReviewField>
      <ReviewField label="Issued">{detail.dateIssuedIso}</ReviewField>
      <ReviewField label="Reference">{detail.orderRef ?? "—"}</ReviewField>
      <ReviewField label="Total">{detail.totalAmountXaf || "—"}</ReviewField>
      {detail.reviewedByName ? (
        <ReviewField label="Reviewed by">
          {detail.reviewedByName}
          {detail.reviewedAtIso ? ` · ${detail.reviewedAtIso.slice(0, 10)}` : ""}
        </ReviewField>
      ) : null}

      <ReviewSection title="Order lines">
        <ReviewLineTable
          headers={["Product", "Qty", "Amount"]}
          rows={detail.lines.map((l) => [
            l.productName,
            `${l.orderQty} ${l.orderUnit}`,
            l.amount ?? "—",
          ])}
        />
      </ReviewSection>

      {detail.payments.length > 0 ? (
        <ReviewSection title="Payments">
          <ReviewLineTable
            headers={["Method", "Date", "Ref"]}
            rows={detail.payments.map((p) => [
              p.method,
              p.amount,
              p.reference ?? "—",
            ])}
          />
        </ReviewSection>
      ) : null}

      {!reviewed ? (
        <Text style={{ fontSize: 13, opacity: 0.7, marginTop: 8 }}>
          Step 1: review lines and payments, then mark reviewed. Step 2: validate on this
          screen.
        </Text>
      ) : canValidate ? (
        <Text style={{ fontSize: 13, opacity: 0.7, marginTop: 8 }}>
          Review complete. Validate when amounts and lines match the paperwork.
        </Text>
      ) : null}
    </ReviewScroll>
  );
}
