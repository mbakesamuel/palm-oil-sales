import { useSafeAreaInsets } from "react-native-safe-area-context";

/** System status bar, notch, and navigation bar insets. */
export function useSafePadding() {
  const insets = useSafeAreaInsets();
  return {
    top: insets.top,
    bottom: insets.bottom,
    left: insets.left,
    right: insets.right,
    /** Use on ScrollView contentContainerStyle (above home indicator / nav bar). */
    scrollBottom: Math.max(insets.bottom, 12),
    /** Use on fixed footers (action buttons). */
    footerBottom: insets.bottom,
  };
}
