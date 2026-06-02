import { Stack } from "expo-router";

export default function ReceiptsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#2d5016" },
        headerTintColor: "#fff",
        headerTitleStyle: { fontWeight: "600" },
      }}
    >
      <Stack.Screen name="index" options={{ title: "Stock receipts" }} />
      <Stack.Screen name="[id]" options={{ title: "Review receipt" }} />
    </Stack>
  );
}
