import { Stack } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { safeStackScreenOptions } from "@/navigation/safe-stack-screen-options";

export default function ReportsLayout() {
  const insets = useSafeAreaInsets();
  return (
    <Stack screenOptions={safeStackScreenOptions(insets)}>
      <Stack.Screen name="stock-vs-commitments" options={{ title: "Stock vs commitments" }} />
      <Stack.Screen name="stock-inquiry" options={{ title: "Stock inquiry" }} />
      <Stack.Screen name="daily-sales-summary" options={{ title: "Daily sales" }} />
      <Stack.Screen name="commitments" options={{ title: "DO commitments" }} />
    </Stack>
  );
}
