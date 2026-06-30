import { useCallback, useState } from "react";
import {
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { apiFetch } from "@/api/client";
import { useSafePadding } from "@/hooks/use-safe-padding";
import { skipPayments, usePosDraft } from "@/pos-wizard/PosDraftContext";
import { PosField, PosStepTitle, posStyles } from "@/pos-wizard/PosFormParts";

export default function PosLinesScreen() {
  const router = useRouter();
  const { scrollBottom } = useSafePadding();
  const { config, draft, setDraft } = usePosDraft();
  const [error, setError] = useState<string | null>(null);
  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState("");
  const [storageLocationId, setStorageLocationId] = useState("");
  const [stockHint, setStockHint] = useState<string | null>(null);

  const isBottle = draft.saleProductMode === "BOTTLE";
  const products = isBottle
    ? (config?.bottledProducts ?? [])
    : (config?.looseProducts ?? []);
  const locations =
    config?.storageLocations.filter(
      (l) => l.salesPointId === config.effectiveSalesPointId,
    ) ?? [];

  const defaultLocation =
    isBottle && config?.bottleOilStoreLocationId
      ? String(config.bottleOilStoreLocationId)
      : locations.find((l) => l.isDefault)?.id.toString() ?? locations[0]?.id.toString() ?? "";

  const previewStock = useCallback(
    async (pid: string, locId: string) => {
      if (!config?.effectiveSalesPointId || !pid || !locId) return;
      try {
        const res = await apiFetch<{
          ok: boolean;
          sellableQty?: string;
          salesBlocked?: boolean;
          message?: string | null;
          error?: string;
        }>("/api/mobile/v1/pos/preview/stock", {
          method: "POST",
          body: JSON.stringify({
            salesPointId: config.effectiveSalesPointId,
            storageLocationId: Number(locId),
            productId: Number(pid),
          }),
        });
        if (res.ok && res.sellableQty != null) {
          setStockHint(
            res.salesBlocked
              ? (res.message ?? "Sales blocked at this location.")
              : `Sellable: ${res.sellableQty}${isBottle ? " units" : " kg"}`,
          );
        } else {
          setStockHint(res.error ?? null);
        }
      } catch {
        setStockHint(null);
      }
    },
    [config?.effectiveSalesPointId, isBottle],
  );

  async function onAddLine() {
    setError(null);
    const pid = productId.trim();
    const loc = (storageLocationId || defaultLocation).trim();
    if (!pid || !qty.trim() || !loc) {
      setError("Product, quantity, and storage location are required.");
      return;
    }

    let unitPrice = "0";
    try {
      const priceRes = await apiFetch<{ ok: boolean; unitPriceExTax?: string; error?: string }>(
        "/api/mobile/v1/pos/preview/price",
        {
          method: "POST",
          body: JSON.stringify({
            customerId: draft.customerId || undefined,
            productId: Number(pid),
            transactionIso: draft.transactionDate,
            isBottle,
            disposition: draft.saleDisposition,
          }),
        },
      );
      if (!priceRes.ok) {
        setError(priceRes.error ?? "Could not resolve price.");
        return;
      }
      unitPrice = priceRes.unitPriceExTax ?? "0";
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not resolve price.");
      return;
    }

    const line = isBottle
      ? {
          productId: pid,
          qtyKg: "0",
          qtyUnits: qty,
          unitPricePerKg: "0",
          unitPricePerUnit: unitPrice,
          storageLocationId: loc,
        }
      : {
          productId: pid,
          qtyKg: qty,
          unitPricePerKg: unitPrice,
          storageLocationId: loc,
        };

    setDraft({ lines: [...draft.lines, line] });
    setProductId("");
    setQty("");
    setStockHint(null);
  }

  function onContinue() {
    if (draft.lines.length === 0) {
      setError("Add at least one line.");
      return;
    }
    if (skipPayments(draft.saleDisposition)) {
      router.push("/(app)/pos/review" as never);
    } else {
      router.push("/(app)/pos/payments" as never);
    }
  }

  function productName(id: string) {
    return products.find((p) => String(p.productId) === id)?.productName ?? id;
  }

  function locationName(id: string) {
    return locations.find((l) => String(l.id) === id)?.name ?? id;
  }

  return (
    <ScrollView
      style={posStyles.screen}
      contentContainerStyle={[posStyles.container, { paddingBottom: scrollBottom + 24 }]}
    >
      <PosStepTitle title="Line items" />

      {draft.lines.map((line, idx) => (
        <View key={`${line.productId}-${idx}`} style={posStyles.card}>
          <Text style={{ fontWeight: "600" }}>{productName(line.productId)}</Text>
          <Text style={posStyles.hint}>
            {isBottle ? `${line.qtyUnits} units` : `${line.qtyKg} kg`} ·{" "}
            {locationName(line.storageLocationId)}
          </Text>
          <Pressable
            onPress={() =>
              setDraft({ lines: draft.lines.filter((_, i) => i !== idx) })
            }
          >
            <Text style={{ color: "#b91c1c", marginTop: 4 }}>Remove</Text>
          </Pressable>
        </View>
      ))}

      <PosField label="Product">
        <View style={{ gap: 8 }}>
          {products.map((p) => (
            <Pressable
              key={p.productId}
              style={[
                posStyles.card,
                productId === String(p.productId) && { borderColor: "#2d5016" },
              ]}
              onPress={() => {
                setProductId(String(p.productId));
                void previewStock(String(p.productId), storageLocationId || defaultLocation);
              }}
            >
              <Text>{p.productName}</Text>
            </Pressable>
          ))}
        </View>
      </PosField>

      <PosField label={isBottle ? "Quantity (units)" : "Quantity (kg)"}>
        <TextInput
          style={posStyles.input}
          value={qty}
          onChangeText={setQty}
          keyboardType="decimal-pad"
        />
      </PosField>

      {!isBottle ? (
        <PosField label="Storage location">
          <View style={{ gap: 8 }}>
            {locations.map((l) => (
              <Pressable
                key={l.id}
                style={[
                  posStyles.card,
                  (storageLocationId || defaultLocation) === String(l.id) && {
                    borderColor: "#2d5016",
                  },
                ]}
                onPress={() => {
                  setStorageLocationId(String(l.id));
                  if (productId) void previewStock(productId, String(l.id));
                }}
              >
                <Text>{l.name}</Text>
              </Pressable>
            ))}
          </View>
        </PosField>
      ) : null}

      {stockHint ? <Text style={posStyles.hint}>{stockHint}</Text> : null}

      <Pressable style={posStyles.secondaryBtn} onPress={() => void onAddLine()}>
        <Text style={posStyles.secondaryBtnText}>Add line</Text>
      </Pressable>

      {error ? <Text style={posStyles.error}>{error}</Text> : null}

      <Pressable style={posStyles.primaryBtn} onPress={onContinue}>
        <Text style={posStyles.primaryBtnText}>Continue</Text>
      </Pressable>
    </ScrollView>
  );
}
