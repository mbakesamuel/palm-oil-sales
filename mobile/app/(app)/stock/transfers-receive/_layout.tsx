import { Stack } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { safeStackScreenOptions } from "@/navigation/safe-stack-screen-options";

export default function TransfersReceiveLayout() {
  const insets = useSafeAreaInsets();
  return (
    <Stack screenOptions={safeStackScreenOptions(insets)}>
      <Stack.Screen name="index" options={{ title: "Receive transfers" }} />
      <Stack.Screen name="[id]" options={{ title: "Receive transfer" }} />
    </Stack>
  );
}
