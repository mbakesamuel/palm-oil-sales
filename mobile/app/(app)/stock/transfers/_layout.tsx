import { Stack } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NestedStackHomeBackButton } from "@/navigation/NestedStackHomeBackButton";
import { safeStackScreenOptions } from "@/navigation/safe-stack-screen-options";

export default function TransfersLayout() {
  const insets = useSafeAreaInsets();
  const stackOptions = safeStackScreenOptions(insets);
  return (
    <Stack screenOptions={stackOptions}>
      <Stack.Screen
        name="index"
        options={{
          title: "Dispatch transfers",
          headerLeft: (props) => (
            <NestedStackHomeBackButton tintColor={props.tintColor} />
          ),
        }}
      />
      <Stack.Screen name="[id]" options={{ title: "Review transfer" }} />
    </Stack>
  );
}
