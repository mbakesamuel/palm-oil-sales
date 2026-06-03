import { useCallback, useEffect, useState } from "react";
import { Alert, Text } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { MobileReceiptDetail } from "@pos/shared";
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

export default function ReceiptReviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [detail, setDetail] = useState<MobileReceiptDetail | null>(null);
  const [busy, setBusy] = useState(true);
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const res = await apiFetch<{ detail: MobileReceiptDetail }>(
        `/api/mobile/v1/stock/receipts/${id}`,
      );
      setDetail(res.detail);
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Could not load receipt.");
      router.back();
    } finally {
      setBusy(false);
    }
  }, [id, router]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onPost() {
    if (!detail) return;
    Alert.alert(
      "Post receipt",
      `Post ${detail.receiptNo} into stock?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Post",
          onPress: () => {
            void (async () => {
              setActing(true);
              try {
                await apiFetch(`/api/mobile/v1/stock/receipts/${detail.id}/post`, {
                  method: "POST",
                });
                Alert.alert("Posted", `${detail.receiptNo} posted.`, [
                  { text: "OK", onPress: () => router.back() },
                ]);
              } catch (e) {
                Alert.alert("Error", e instanceof Error ? e.message : "Could not post.");
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

  const canPost = detail.status === "DRAFT";

  return (
    <ReviewScroll
      footer={
        canPost ? (
          <ReviewPrimaryButton
            label="Post receipt"
            onPress={() => void onPost()}
            loading={acting}
          />
        ) : null
      }
    >
      <ReviewStatusBadge label={detail.status} />
      <Text style={{ fontSize: 20, fontWeight: "700" }}>{detail.receiptNo}</Text>

      <ReviewField label="Sales point">{detail.salesPointName}</ReviewField>
      <ReviewField label="Received on">{detail.receivedAtIso.slice(0, 10)}</ReviewField>
      <ReviewField label="Supplier">{detail.supplierLabel}</ReviewField>
      <ReviewField label="Drafted by">{detail.createdByName}</ReviewField>
      {detail.notes ? <ReviewField label="Notes">{detail.notes}</ReviewField> : null}
      <ReviewField label="Total quantity">{detail.totalQty}</ReviewField>

      <ReviewSection title="Lines">
        <ReviewLineTable
          headers={["Product", "Qty", "Location"]}
          rows={detail.lines.map((l) => [
            l.productName,
            `${l.qty} ${l.uom}`,
            l.storageLocationName,
          ])}
        />
      </ReviewSection>

      {canPost ? (
        <Text style={{ fontSize: 13, opacity: 0.7 }}>
          Confirm quantities and storage locations match the physical delivery before
          posting.
        </Text>
      ) : null}
    </ReviewScroll>
  );
}
