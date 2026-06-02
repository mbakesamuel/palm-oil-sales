import { Redirect, Stack, useRootNavigationState } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/auth/AuthProvider";
import { safeStackScreenOptions } from "@/navigation/safe-stack-screen-options";

export default function AppLayout() {
  const { loading, session } = useAuth();
  const nav = useRootNavigationState();
  const insets = useSafeAreaInsets();
  const stackOptions = safeStackScreenOptions(insets);

  if (!nav?.key || loading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
        }}
      >
        <ActivityIndicator size="large" color="#2d5016" />
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Stack screenOptions={stackOptions}>
      <Stack.Screen name="index" options={{ title: "POS Monitor" }} />
      <Stack.Screen name="reports" options={{ headerShown: false }} />
      <Stack.Screen name="validation" options={{ headerShown: false }} />
      <Stack.Screen name="stock" options={{ headerShown: false }} />
    </Stack>
  );
}
