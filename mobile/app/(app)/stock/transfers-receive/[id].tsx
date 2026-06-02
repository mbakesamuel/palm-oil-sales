import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { MobileTransferDetail } from "@pos/shared";
import { apiFetch } from "@/api/client";
import {
  ReviewField,
  ReviewLoader,
  ReviewPrimaryButton,
  ReviewScroll,
  ReviewSection,
  ReviewStatusBadge,
} from "@/components/approval-review";

export default function TransferReceiveReviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [detail, setDetail] = useState<MobileTransferDetail | null>(null);
  const [receiveInto, setReceiveInto] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(true);
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const res = await apiFetch<{ detail: MobileTransferDetail }>(
        `/api/mobile/v1/stock/transfers/${id}?forReceive=1`,
      );
      setDetail(res.detail);
      const defaultLoc = res.detail.receiveLocations?.[0]?.id;
      const initial: Record<string, number> = {};
      for (const line of res.detail.lines) {
        initial[line.id] = defaultLoc ?? 0;
      }
      setReceiveInto(initial);
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

  const locations = detail?.receiveLocations ?? [];

  const allLinesAssigned = useMemo(() => {
    if (!detail) return false;
    return detail.lines.every((l) => {
      const locId = receiveInto[l.id];
      return locId != null && locId > 0;
    });
  }, [detail, receiveInto]);

  async function onReceive() {
    if (!detail || !allLinesAssigned) return;
    Alert.alert(
      "Receive transfer",
      `Receive ${detail.transferNo} at ${detail.toSalesPointName}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Receive",
          onPress: () => {
            void (async () => {
              setActing(true);
              try {
                await apiFetch(`/api/mobile/v1/stock/transfers/${detail.id}/receive`, {
                  method: "POST",
                  body: JSON.stringify({
                    lines: detail.lines.map((l) => ({
                      lineId: l.id,
                      toStorageLocationId: receiveInto[l.id],
                    })),
                  }),
                });
                Alert.alert("Received", `${detail.transferNo} received.`, [
                  { text: "OK", onPress: () => router.back() },
                ]);
              } catch (e) {
                Alert.alert("Error", e instanceof Error ? e.message : "Could not receive.");
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

  const canReceive = detail.status === "DISPATCHED";

  return (
    <ReviewScroll
      footer={
        canReceive ? (
          <ReviewPrimaryButton
            label="Confirm receipt"
            onPress={() => void onReceive()}
            disabled={acting || !allLinesAssigned}
          />
        ) : null
      }
    >
      <ReviewStatusBadge label={detail.status} />
      <Text style={{ fontSize: 20, fontWeight: "700" }}>{detail.transferNo}</Text>

      <ReviewField label="From">{detail.fromSalesPointName}</ReviewField>
      <ReviewField label="Receive at">{detail.toSalesPointName}</ReviewField>
      {detail.dispatchedByName ? (
        <ReviewField label="Dispatched by">{detail.dispatchedByName}</ReviewField>
      ) : null}

      <ReviewSection title="Lines — receive into">
        {detail.lines.map((line) => (
          <View
            key={line.id}
            style={{
              backgroundColor: "#fff",
              borderRadius: 8,
              borderWidth: 1,
              borderColor: "#e2e8e0",
              padding: 10,
              marginBottom: 8,
              gap: 6,
            }}
          >
            <Text style={{ fontWeight: "600" }}>{line.productName}</Text>
            <Text style={{ fontSize: 12, opacity: 0.7 }}>
              {line.qty} {line.uom} from {line.fromStorageLocationName}
            </Text>
            {locations.map((loc) => {
              const selected = receiveInto[line.id] === loc.id;
              return (
                <Pressable
                  key={loc.id}
                  onPress={() =>
                    setReceiveInto((prev) => ({ ...prev, [line.id]: loc.id }))
                  }
                  style={{
                    padding: 8,
                    borderRadius: 6,
                    borderWidth: 1,
                    borderColor: selected ? "#2d5016" : "#e2e8e0",
                    backgroundColor: selected ? "#e8f0e4" : "#fff",
                  }}
                >
                  <Text style={{ fontSize: 13 }}>
                    {loc.name}
                    {loc.isSellable ? "" : " (unsellable)"}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ))}
      </ReviewSection>

      {canReceive ? (
        <Text style={{ fontSize: 13, opacity: 0.7 }}>
          Choose a storage location for each line, then confirm receipt.
        </Text>
      ) : null}
    </ReviewScroll>
  );
}
