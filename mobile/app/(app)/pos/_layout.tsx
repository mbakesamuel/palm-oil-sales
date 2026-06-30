import { Stack } from "expo-router";
import { PosDraftProvider } from "@/pos-wizard/PosDraftContext";
import { safeStackScreenOptions } from "@/navigation/safe-stack-screen-options";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function PosLayout() {
  const insets = useSafeAreaInsets();
  const stackOptions = safeStackScreenOptions(insets);

  return (
    <PosDraftProvider>
      <Stack screenOptions={stackOptions}>
        <Stack.Screen name="index" options={{ title: "Raise sale" }} />
        <Stack.Screen name="customer" options={{ title: "Customer" }} />
        <Stack.Screen name="delivery-order" options={{ title: "Delivery order" }} />
        <Stack.Screen name="lines" options={{ title: "Line items" }} />
        <Stack.Screen name="payments" options={{ title: "Payments" }} />
        <Stack.Screen name="review" options={{ title: "Review" }} />
      </Stack>
    </PosDraftProvider>
  );
}
