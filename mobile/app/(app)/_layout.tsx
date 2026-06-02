import { Redirect, Stack, useRootNavigationState } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "@/auth/AuthProvider";

export default function AppLayout() {
  const { loading, session } = useAuth();
  const nav = useRootNavigationState();

  if (!nav?.key || loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#2d5016" />
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#2d5016" },
        headerTintColor: "#fff",
        headerTitleStyle: { fontWeight: "600" },
      }}
    >
      <Stack.Screen name="index" options={{ title: "POS Monitor" }} />
      <Stack.Screen name="reports" options={{ headerShown: false }} />
      <Stack.Screen name="validation" options={{ headerShown: false }} />
      <Stack.Screen name="stock" options={{ headerShown: false }} />
    </Stack>
  );
}
