import { Redirect, Stack, useRootNavigationState } from "expo-router";
import { View } from "react-native";
import { useAuth } from "@/auth/AuthProvider";
import { LoginScreenSkeleton } from "@/components/skeleton";
import { agro } from "@/theme/agro";

export default function AuthLayout() {
  const { loading, session } = useAuth();
  const nav = useRootNavigationState();

  if (!nav?.key || loading) {
    return (
      <View style={{ flex: 1, backgroundColor: agro.cream }}>
        <LoginScreenSkeleton />
      </View>
    );
  }

  if (session) {
    return <Redirect href="/(app)" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
    </Stack>
  );
}
