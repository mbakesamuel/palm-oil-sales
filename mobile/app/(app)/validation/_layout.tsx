import { Stack } from "expo-router";

export default function ValidationLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#2d5016" },
        headerTintColor: "#fff",
        headerTitleStyle: { fontWeight: "600" },
      }}
    >
      <Stack.Screen name="index" options={{ title: "Approvals" }} />
      <Stack.Screen name="sale/[id]" options={{ title: "Review sale" }} />
      <Stack.Screen name="do/[id]" options={{ title: "Review delivery order" }} />
    </Stack>
  );
}
