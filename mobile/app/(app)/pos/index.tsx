import { ScrollView, Text, View } from "react-native";

import { useRouter } from "expo-router";

import { Pressable } from "react-native";

import { ListScreenSkeleton } from "@/components/skeleton";

import { useSafePadding } from "@/hooks/use-safe-padding";

import {

  usePosDraft,

  type PosSaleDisposition,

  type PosSaleProductMode,

} from "@/pos-wizard/PosDraftContext";

import { PosChoiceButton, PosStepTitle, posStyles } from "@/pos-wizard/PosFormParts";



function salePurposeHint(

  mode: PosSaleProductMode,

  disposition: PosSaleDisposition,

): string {

  const isBottle = mode === "BOTTLE";

  if (disposition === "RATION") {

    return isBottle

      ? "Worker ration — worker price, no payment."

      : "Worker dept sale — no DO, tax, or payment.";

  }

  if (disposition === "PUBLIC_RELATION") {

    return isBottle

      ? "Complimentary issue — zero price, no payment."

      : "Complimentary issue — zero price, no DO, tax, or payment.";

  }

  return isBottle

    ? "Normal bottle sale — payment required."

    : "Normal sale — DO, tax, and payment apply.";

}



function applyProductModeChange(
  mode: PosSaleProductMode,
  setDraft: ReturnType<typeof usePosDraft>["setDraft"],
) {
  setDraft({
    saleProductMode: mode,
    saleDisposition: "NORMAL",
    lines: [],
    payments: [],
    deliveryOrderNo: "",
    referenceNumber: "",
    useWalkInCustomer: false,
    walkInCustomerName: "",
    typedCustomerName: "",
    customerId: "",
    customerName: "",
    ...(mode === "BOTTLE" ? { vehicleNumber: "" } : {}),
  });
}



export default function PosTypeScreen() {

  const router = useRouter();

  const { scrollBottom } = useSafePadding();

  const { config, configError, loadingConfig, draft, setDraft } = usePosDraft();



  if (loadingConfig) return <ListScreenSkeleton cards={3} />;



  if (configError || !config) {

    return (

      <View style={[posStyles.screen, posStyles.container]}>

        <Text style={posStyles.error}>{configError ?? "POS is not available."}</Text>

      </View>

    );

  }



  const isBota = config.isBota;
  const posConfig = config;
  const isBottle = draft.saleProductMode === "BOTTLE";

  function setDisposition(disposition: PosSaleDisposition) {
    if (disposition === "RATION") {
      setDraft({
        saleDisposition: "RATION",
        useWalkInCustomer: false,
        walkInCustomerName: "",
        deliveryOrderNo: "",
        typedCustomerName: "",
        customerId: posConfig.rationCustomerId,

        customerName: "",

        lines: [],

        payments: [],

      });

      return;

    }

    if (disposition === "PUBLIC_RELATION") {

      setDraft({

        saleDisposition: "PUBLIC_RELATION",

        useWalkInCustomer: false,

        walkInCustomerName: "",

        deliveryOrderNo: "",

        typedCustomerName: "",

        customerId: posConfig.publicRelationCustomerId,

        customerName: "",

        lines: [],

        payments: [],

      });

      return;

    }

    setDraft({

      saleDisposition: "NORMAL",

      typedCustomerName: "",

      customerId: "",

      customerName: "",

    });

  }



  function onContinue() {

    router.push("/(app)/pos/customer" as never);

  }



  return (

    <ScrollView

      style={posStyles.screen}

      contentContainerStyle={[posStyles.container, { paddingBottom: scrollBottom + 24 }]}

    >

      <PosStepTitle

        title="Sale type"

        subtitle={

          config.workingMonth?.salesPointName

            ? `${config.workingMonth.salesPointName} · working month ${config.workingMonth.calendarYear}-${String(config.workingMonth.calendarMonth).padStart(2, "0")}`

            : undefined

        }

      />



      {isBota ? (

        <>

          <Text style={posStyles.hint}>Product sale type</Text>

          <View style={posStyles.segmentRow}>

            <Pressable

              style={[

                posStyles.segmentBtn,

                draft.saleProductMode === "LOOSE" && posStyles.segmentBtnActive,

              ]}

              onPress={() => applyProductModeChange("LOOSE", setDraft)}

            >

              <Text

                style={[

                  posStyles.segmentLabel,

                  draft.saleProductMode === "LOOSE" && posStyles.segmentLabelActive,

                ]}

              >

                Loose product

              </Text>

            </Pressable>

            <Pressable

              style={[

                posStyles.segmentBtn,

                draft.saleProductMode === "BOTTLE" && posStyles.segmentBtnActive,

              ]}

              onPress={() => applyProductModeChange("BOTTLE", setDraft)}

            >

              <Text

                style={[

                  posStyles.segmentLabel,

                  draft.saleProductMode === "BOTTLE" && posStyles.segmentLabelActive,

                ]}

              >

                Bottle product

              </Text>

            </Pressable>

          </View>

        </>

      ) : (

        <Text style={posStyles.hint}>Loose palm oil sales at your sales point.</Text>

      )}



      <Text style={[posStyles.hint, { marginTop: 8 }]}>Sale purpose</Text>

      <PosChoiceButton

        label="Normal sale"

        description={isBottle ? "Payment required" : "DO, tax, and payment apply"}

        selected={draft.saleDisposition === "NORMAL"}

        onPress={() => setDisposition("NORMAL")}

      />

      <PosChoiceButton

        label="Ration"

        description={

          isBottle ? "Worker price, no payment" : "Worker dept — no DO, tax, or payment"

        }

        selected={draft.saleDisposition === "RATION"}

        onPress={() => setDisposition("RATION")}

      />

      <PosChoiceButton

        label="Public relations"

        description={

          isBottle

            ? "Complimentary — zero price, no payment"

            : "Complimentary — zero price, no DO, tax, or payment"

        }

        selected={draft.saleDisposition === "PUBLIC_RELATION"}

        onPress={() => setDisposition("PUBLIC_RELATION")}

      />

      <Text style={posStyles.hint}>{salePurposeHint(draft.saleProductMode, draft.saleDisposition)}</Text>



      <Pressable style={[posStyles.primaryBtn, { marginTop: 16 }]} onPress={onContinue}>

        <Text style={posStyles.primaryBtnText}>Continue</Text>

      </Pressable>

    </ScrollView>

  );

}


