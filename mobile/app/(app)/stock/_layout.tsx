import { Stack } from "expo-router";

export default function StockLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#2d5016" },
        headerTintColor: "#fff",
        headerTitleStyle: { fontWeight: "600" },
      }}
    >
      <Stack.Screen name="receipts" options={{ headerShown: false }} />
      <Stack.Screen name="transfers" options={{ headerShown: false }} />
      <Stack.Screen name="transfers-receive" options={{ headerShown: false }} />
    </Stack>
  );
}
