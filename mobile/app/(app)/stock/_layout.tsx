import { Stack } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { safeStackScreenOptions } from "@/navigation/safe-stack-screen-options";

export default function StockLayout() {
  const insets = useSafeAreaInsets();
  return (
    <Stack screenOptions={safeStackScreenOptions(insets)}>
      <Stack.Screen name="receipts" options={{ headerShown: false }} />
      <Stack.Screen name="transfers" options={{ headerShown: false }} />
      <Stack.Screen name="transfers-receive" options={{ headerShown: false }} />
    </Stack>
  );
}
