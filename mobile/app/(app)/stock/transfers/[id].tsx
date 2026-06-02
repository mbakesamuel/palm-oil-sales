import { useCallback, useEffect, useState } from "react";
import { Alert, Text } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { MobileTransferDetail } from "@pos/shared";
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

export default function TransferDispatchReviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [detail, setDetail] = useState<MobileTransferDetail | null>(null);
  const [busy, setBusy] = useState(true);
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const res = await apiFetch<{ detail: MobileTransferDetail }>(
        `/api/mobile/v1/stock/transfers/${id}`,
      );
      setDetail(res.detail);
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Could not load transfer.");
      router.back();
    } finally {
      setBusy(false);
    }
  }, [id, router]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onDispatch() {
    if (!detail) return;
    Alert.alert(
      "Dispatch transfer",
      `Dispatch ${detail.transferNo}? Stock will leave ${detail.fromSalesPointName}.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Dispatch",
          onPress: () => {
            void (async () => {
              setActing(true);
              try {
                await apiFetch(`/api/mobile/v1/stock/transfers/${detail.id}/dispatch`, {
                  method: "POST",
                });
                Alert.alert("Dispatched", `${detail.transferNo} dispatched.`, [
                  { text: "OK", onPress: () => router.back() },
                ]);
              } catch (e) {
                Alert.alert("Error", e instanceof Error ? e.message : "Could not dispatch.");
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

  const canDispatch = detail.status === "DRAFT";

  return (
    <ReviewScroll
      footer={
        canDispatch ? (
          <ReviewPrimaryButton
            label="Dispatch transfer"
            onPress={() => void onDispatch()}
            disabled={acting}
          />
        ) : null
      }
    >
      <ReviewStatusBadge label={detail.status} />
      <Text style={{ fontSize: 20, fontWeight: "700" }}>{detail.transferNo}</Text>

      <ReviewField label="From">{detail.fromSalesPointName}</ReviewField>
      <ReviewField label="To">{detail.toSalesPointName}</ReviewField>
      <ReviewField label="Drafted by">{detail.createdByName}</ReviewField>
      {detail.notes ? <ReviewField label="Notes">{detail.notes}</ReviewField> : null}
      <ReviewField label="Total quantity">{detail.totalQty}</ReviewField>

      <ReviewSection title="Lines">
        <ReviewLineTable
          headers={["Product", "Qty", "From location"]}
          rows={detail.lines.map((l) => [
            l.productName,
            `${l.qty} ${l.uom}`,
            l.fromStorageLocationName,
          ])}
        />
      </ReviewSection>

      {canDispatch ? (
        <Text style={{ fontSize: 13, opacity: 0.7 }}>
          Confirm available stock at source locations before dispatching.
        </Text>
      ) : null}
    </ReviewScroll>
  );
}
