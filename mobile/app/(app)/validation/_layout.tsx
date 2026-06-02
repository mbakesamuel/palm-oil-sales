import { Stack } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { safeStackScreenOptions } from "@/navigation/safe-stack-screen-options";

export default function ValidationLayout() {
  const insets = useSafeAreaInsets();
  return (
    <Stack screenOptions={safeStackScreenOptions(insets)}>
      <Stack.Screen name="index" options={{ title: "Approvals" }} />
      <Stack.Screen name="sale/[id]" options={{ title: "Review sale" }} />
      <Stack.Screen name="do/[id]" options={{ title: "Review delivery order" }} />
    </Stack>
  );
}
