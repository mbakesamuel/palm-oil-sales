import type { NativeStackNavigationOptions } from "@react-navigation/native-stack";

const HEADER_BG = "#2d5016";

/** Stack options that keep content above the system navigation bar. */
export function safeStackScreenOptions(insets: {
  top: number;
  bottom: number;
  left: number;
  right: number;
}): NativeStackNavigationOptions {
  return {
    headerStyle: { backgroundColor: HEADER_BG },
    headerTintColor: "#fff",
    headerTitleStyle: { fontWeight: "600" },
    contentStyle: {
      flex: 1,
      backgroundColor: "#f8faf8",
    },
    safeAreaInsets: {
      top: insets.top,
      bottom: insets.bottom,
      left: insets.left,
      right: insets.right,
    },
  };
}
