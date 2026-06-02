import { Stack } from "expo-router";

export default function TransfersLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#2d5016" },
        headerTintColor: "#fff",
        headerTitleStyle: { fontWeight: "600" },
      }}
    >
      <Stack.Screen name="index" options={{ title: "Dispatch transfers" }} />
      <Stack.Screen name="[id]" options={{ title: "Review transfer" }} />
    </Stack>
  );
}
