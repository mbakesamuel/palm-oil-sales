import { useCallback, useEffect, useState } from "react";
import { Alert, Text } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { MobileConsignmentDetail } from "@pos/shared";
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

export default function ConsignmentReviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [detail, setDetail] = useState<MobileConsignmentDetail | null>(null);
  const [busy, setBusy] = useState(true);
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const res = await apiFetch<{ detail: MobileConsignmentDetail }>(
        `/api/mobile/v1/validation/consignment-notes/${id}`,
      );
      setDetail(res.detail);
    } catch (e) {
      Alert.alert(
        "Error",
        e instanceof Error ? e.message : "Could not load consignment note.",
      );
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
      "Validate consignment",
      `Approve vehicle consignment ${detail.consignmentNoteNo}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Validate",
          onPress: () => {
            void (async () => {
              setActing(true);
              try {
                await apiFetch(
                  `/api/mobile/v1/validation/consignment-notes/${detail.id}/validate`,
                  { method: "POST" },
                );
                Alert.alert("Validated", `${detail.consignmentNoteNo} validated.`, [
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
            label="Validate consignment"
            onPress={() => void onValidate()}
            loading={acting}
          />
        ) : null
      }
    >
      <ReviewStatusBadge label={detail.status} />
      <Text style={{ fontSize: 20, fontWeight: "700" }}>{detail.consignmentNoteNo}</Text>

      <ReviewField label="Invoice">{detail.invoiceNo}</ReviewField>
      <ReviewField label="Customer">{detail.customerName}</ReviewField>
      <ReviewField label="Sales point">{detail.salesPointName ?? "—"}</ReviewField>
      <ReviewField label="Destination">{detail.destination}</ReviewField>
      <ReviewField label="Vehicle">{detail.vehicleNumber || "—"}</ReviewField>
      <ReviewField label="Date of lifting">{detail.dateOfLiftingIso}</ReviewField>
      <ReviewField label="Date of consignment">{detail.dateOfConsignmentIso}</ReviewField>
      <ReviewField label="Delivery order">{detail.deliveryOrderNo ?? "—"}</ReviewField>
      <ReviewField label="Prepared by">{detail.createdByName}</ReviewField>

      <ReviewSection title="Consigner">
        <ReviewField label="Name">{detail.consignerName}</ReviewField>
        <ReviewField label="Designation">{detail.consignerDesignation}</ReviewField>
      </ReviewSection>

      <ReviewSection title="Receiver">
        <ReviewField label="Name">{detail.receiverName}</ReviewField>
        <ReviewField label="NIC no.">{detail.receiverNicNo}</ReviewField>
        <ReviewField label="NIC place of issue">{detail.receiverNicPlaceOfIssue}</ReviewField>
        <ReviewField label="Received date">{detail.receivedDateIso ?? "—"}</ReviewField>
      </ReviewSection>

      <ReviewSection title="Products lifted">
        <ReviewLineTable
          headers={["#", "Product", "Qty (kg)"]}
          rows={detail.lines.map((l) => [
            String(l.lineNo),
            l.productName,
            l.qtyKg,
          ])}
        />
      </ReviewSection>
    </ReviewScroll>
  );
}
