import type { NativeStackNavigationOptions } from "@react-navigation/native-stack";
import { agro } from "@/theme/agro";

/** Stack options that keep content above the system navigation bar. */
export function safeStackScreenOptions(insets: {
  top: number;
  bottom: number;
  left: number;
  right: number;
}): NativeStackNavigationOptions {
  return {
    headerStyle: { backgroundColor: agro.forest },
    headerTintColor: "#fff",
    headerTitleStyle: { fontWeight: "600" },
    contentStyle: {
      flex: 1,
      backgroundColor: agro.canvas,
    },
  };
}
