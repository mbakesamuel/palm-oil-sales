import { Stack } from "expo-router";

export default function ReportsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#2d5016" },
        headerTintColor: "#fff",
        headerTitleStyle: { fontWeight: "600" },
      }}
    >
      <Stack.Screen name="stock-vs-commitments" options={{ title: "Stock vs commitments" }} />
      <Stack.Screen name="stock-inquiry" options={{ title: "Stock inquiry" }} />
      <Stack.Screen name="daily-sales-summary" options={{ title: "Daily sales" }} />
      <Stack.Screen name="commitments" options={{ title: "DO commitments" }} />
    </Stack>
  );
}
