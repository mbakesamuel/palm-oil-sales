import { useCallback, useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import type { MobilePosCustomerRow } from "@pos/shared";
import { apiFetch } from "@/api/client";
import { useSafePadding } from "@/hooks/use-safe-padding";
import {
  skipDeliveryOrder,
  usePosDraft,
  usesTypedCustomerName,
} from "@/pos-wizard/PosDraftContext";
import { PosField, PosStepTitle, posStyles } from "@/pos-wizard/PosFormParts";
import { PosDateField } from "@/pos-wizard/PosDateField";

export default function PosCustomerScreen() {
  const router = useRouter();
  const { scrollBottom } = useSafePadding();
  const { config, draft, setDraft } = usePosDraft();
  const [customers, setCustomers] = useState<MobilePosCustomerRow[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  const typedName = usesTypedCustomerName(draft.saleDisposition);
  const isBottle = draft.saleProductMode === "BOTTLE";
  const walkIn = isBottle && draft.useWalkInCustomer;

  const loadCustomers = useCallback(async (q: string) => {
    const res = await apiFetch<{ rows: MobilePosCustomerRow[] }>(
      `/api/mobile/v1/pos/customers?q=${encodeURIComponent(q)}`,
    );
    setCustomers(res.rows);
  }, []);

  useEffect(() => {
    if (!typedName && !walkIn) {
      void loadCustomers("");
    }
  }, [loadCustomers, typedName, walkIn]);

  function onSearch(text: string) {
    setQuery(text);
    void loadCustomers(text);
  }

  function onContinue() {
    setError(null);
    if (typedName) {
      if (!draft.typedCustomerName.trim()) {
        setError("Enter the customer name.");
        return;
      }
    } else if (walkIn) {
      if (!draft.walkInCustomerName.trim()) {
        setError("Enter the walk-in customer name.");
        return;
      }
    } else if (!draft.customerId) {
      setError("Select a customer.");
      return;
    }
    if (!isBottle && !draft.vehicleNumber.trim()) {
      setError("Vehicle number is required.");
      return;
    }
    if (!draft.transactionDate.trim()) {
      setError("Transaction date is required.");
      return;
    }

    if (skipDeliveryOrder(draft.saleProductMode, draft.saleDisposition)) {
      router.push("/(app)/pos/lines" as never);
    } else {
      router.push("/(app)/pos/delivery-order" as never);
    }
  }

  return (
    <ScrollView
      style={posStyles.screen}
      contentContainerStyle={[posStyles.container, { paddingBottom: scrollBottom + 24 }]}
    >
      <PosStepTitle title="Customer & details" />

      {typedName ? (
        <PosField label="Customer name">
          <TextInput
            style={posStyles.input}
            value={draft.typedCustomerName}
            onChangeText={(v) => setDraft({ typedCustomerName: v })}
            placeholder="Name on invoice"
          />
        </PosField>
      ) : isBottle ? (
        <>
          <Pressable
            style={posStyles.secondaryBtn}
            onPress={() =>
              setDraft({
                useWalkInCustomer: !draft.useWalkInCustomer,
                customerId: "",
                customerName: "",
              })
            }
          >
            <Text style={posStyles.secondaryBtnText}>
              {draft.useWalkInCustomer ? "Use registered customer" : "Walk-in customer"}
            </Text>
          </Pressable>
          {walkIn ? (
            <PosField label="Walk-in name">
              <TextInput
                style={posStyles.input}
                value={draft.walkInCustomerName}
                onChangeText={(v) => setDraft({ walkInCustomerName: v })}
                placeholder="Customer name"
              />
            </PosField>
          ) : (
            <>
              <PosField label="Search customer">
                <TextInput
                  style={posStyles.input}
                  value={query}
                  onChangeText={onSearch}
                  placeholder="Type to search"
                />
              </PosField>
              {customers.map((c) => (
                <Pressable
                  key={c.id}
                  style={[
                    posStyles.card,
                    draft.customerId === c.id && { borderColor: "#2d5016" },
                  ]}
                  onPress={() =>
                    setDraft({ customerId: c.id, customerName: c.name, useWalkInCustomer: false })
                  }
                >
                  <Text style={{ fontWeight: "600" }}>{c.name}</Text>
                </Pressable>
              ))}
            </>
          )}
        </>
      ) : (
        <>
          <PosField label="Search customer">
            <TextInput
              style={posStyles.input}
              value={query}
              onChangeText={onSearch}
              placeholder="Type to search"
            />
          </PosField>
          {customers.map((c) => (
            <Pressable
              key={c.id}
              style={[
                posStyles.card,
                draft.customerId === c.id && { borderColor: "#2d5016" },
              ]}
              onPress={() => setDraft({ customerId: c.id, customerName: c.name })}
            >
              <Text style={{ fontWeight: "600" }}>{c.name}</Text>
            </Pressable>
          ))}
          {!isBottle ? (
            <PosField label="Reference (optional)">
              <TextInput
                style={posStyles.input}
                value={draft.referenceNumber}
                onChangeText={(v) => setDraft({ referenceNumber: v })}
              />
            </PosField>
          ) : null}
        </>
      )}

      {!isBottle ? (
        <PosField label="Vehicle number">
          <TextInput
            style={posStyles.input}
            value={draft.vehicleNumber}
            onChangeText={(v) => setDraft({ vehicleNumber: v })}
            placeholder="Registration"
            autoCapitalize="characters"
          />
        </PosField>
      ) : null}

      <PosDateField
        label="Transaction date"
        value={draft.transactionDate}
        onChange={(iso) => setDraft({ transactionDate: iso })}
        minIso={config?.transactionDateMinIso}
        maxIso={config?.transactionDateMaxIso}
        hint={
          config?.transactionDateMinIso
            ? `Working month: ${config.transactionDateMinIso} to ${config.transactionDateMaxIso}`
            : undefined
        }
      />

      {error ? <Text style={posStyles.error}>{error}</Text> : null}

      <Pressable style={posStyles.primaryBtn} onPress={onContinue}>
        <Text style={posStyles.primaryBtnText}>Continue</Text>
      </Pressable>
    </ScrollView>
  );
}
