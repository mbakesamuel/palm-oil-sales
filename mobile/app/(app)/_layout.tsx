import { Redirect, Stack, useRootNavigationState } from "expo-router";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/auth/AuthProvider";
import { AppBootSkeleton } from "@/components/skeleton";
import { safeStackScreenOptions } from "@/navigation/safe-stack-screen-options";
import { agro } from "@/theme/agro";

export default function AppLayout() {
  const { loading, session } = useAuth();
  const nav = useRootNavigationState();
  const insets = useSafeAreaInsets();
  const stackOptions = safeStackScreenOptions(insets);

  if (!nav?.key || loading) {
    return (
      <View style={{ flex: 1, backgroundColor: agro.canvas }}>
        <AppBootSkeleton />
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Stack screenOptions={stackOptions}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="reports" options={{ headerShown: false }} />
      <Stack.Screen name="validation" options={{ headerShown: false }} />
      <Stack.Screen name="stock" options={{ headerShown: false }} />
      <Stack.Screen name="pos" options={{ headerShown: false }} />
    </Stack>
  );
}
