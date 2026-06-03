import { useEffect, useRef } from "react";
import {
  Animated,
  StyleSheet,
  View,
  type DimensionValue,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useSafePadding } from "@/hooks/use-safe-padding";
import { agro, agroHomeSheet, agroHomeTile } from "@/theme/agro";

const skeletonColor = agro.border;

export function SkeletonBlock(props: {
  width?: DimensionValue;
  height: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const opacity = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.8,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.35,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        {
          width: props.width ?? "100%",
          height: props.height,
          borderRadius: props.borderRadius ?? 6,
          backgroundColor: skeletonColor,
          opacity,
        },
        props.style,
      ]}
    />
  );
}

export function ButtonSkeleton(props: { variant?: "primary" | "secondary" }) {
  const isSecondary = props.variant === "secondary";
  return (
    <View
      style={[
        styles.buttonShell,
        isSecondary ? styles.buttonShellSecondary : styles.buttonShellPrimary,
      ]}
    >
      <SkeletonBlock width="42%" height={16} borderRadius={4} />
    </View>
  );
}

export function ListCardSkeleton() {
  return (
    <View style={styles.listCard}>
      <SkeletonBlock width="55%" height={16} borderRadius={4} />
      <SkeletonBlock width="72%" height={14} borderRadius={4} />
      <SkeletonBlock width="48%" height={12} borderRadius={4} />
      <SkeletonBlock width="28%" height={14} borderRadius={4} style={styles.listCardAction} />
    </View>
  );
}

export function ListScreenSkeleton(props: { cards?: number; showHint?: boolean }) {
  const { scrollBottom } = useSafePadding();
  const count = props.cards ?? 4;

  return (
    <View style={[styles.listScreen, { paddingBottom: scrollBottom + 24 }]}>
      {props.showHint !== false ? (
        <SkeletonBlock width="92%" height={13} borderRadius={4} />
      ) : null}
      <SkeletonBlock width="36%" height={12} borderRadius={4} style={styles.sectionLabel} />
      {Array.from({ length: count }, (_, i) => (
        <ListCardSkeleton key={i} />
      ))}
    </View>
  );
}

export function ReviewDetailSkeleton() {
  return (
    <>
      <SkeletonBlock width={120} height={22} borderRadius={6} />
      <SkeletonBlock width="68%" height={24} borderRadius={6} />
      {Array.from({ length: 5 }, (_, i) => (
        <View key={i} style={styles.field}>
          <SkeletonBlock width="32%" height={11} borderRadius={4} />
          <SkeletonBlock width={i % 2 === 0 ? "78%" : "54%"} height={15} borderRadius={4} />
        </View>
      ))}
      <SkeletonBlock width="40%" height={12} borderRadius={4} style={styles.sectionLabel} />
      <View style={styles.tableShell}>
        <View style={styles.tableHead}>
          <SkeletonBlock width="30%" height={12} borderRadius={4} />
          <SkeletonBlock width="22%" height={12} borderRadius={4} />
          <SkeletonBlock width="26%" height={12} borderRadius={4} />
        </View>
        {Array.from({ length: 3 }, (_, i) => (
          <View key={i} style={styles.tableRow}>
            <SkeletonBlock width="28%" height={12} borderRadius={4} />
            <SkeletonBlock width="20%" height={12} borderRadius={4} />
            <SkeletonBlock width="24%" height={12} borderRadius={4} />
          </View>
        ))}
      </View>
    </>
  );
}

export function LoginScreenSkeleton() {
  return (
    <View style={styles.loginScreen}>
      <SkeletonBlock width="72%" height={28} borderRadius={6} />
      <SkeletonBlock width="48%" height={14} borderRadius={4} />
      <SkeletonBlock width="100%" height={44} borderRadius={10} style={styles.loginInput} />
      <SkeletonBlock width="100%" height={44} borderRadius={10} />
      <View style={styles.loginButton}>
        <ButtonSkeleton />
      </View>
    </View>
  );
}

export function AppBootSkeleton() {
  const { top, scrollBottom } = useSafePadding();

  return (
    <View style={[styles.bootScreen, { paddingTop: top + 8, paddingBottom: scrollBottom + 24 }]}>
      <View style={styles.bootTopPanel}>
        <View style={styles.bootHeaderRow}>
          <SkeletonBlock width={40} height={40} borderRadius={20} />
          <SkeletonBlock width="40%" height={18} borderRadius={6} />
          <SkeletonBlock width={40} height={40} borderRadius={20} />
        </View>
        <View style={styles.bootProfile}>
          <SkeletonBlock width={56} height={56} borderRadius={28} />
          <View style={styles.bootProfileText}>
            <SkeletonBlock width="70%" height={18} borderRadius={4} />
            <SkeletonBlock width="55%" height={14} borderRadius={4} />
            <SkeletonBlock width="48%" height={13} borderRadius={4} />
          </View>
        </View>
      </View>
      <View style={styles.bootContentSheet}>
        <View style={styles.bootTabs}>
          <SkeletonBlock width="28%" height={14} borderRadius={4} />
          <SkeletonBlock width="28%" height={14} borderRadius={4} />
          <SkeletonBlock width="20%" height={14} borderRadius={4} />
        </View>
        <View style={styles.bootGrid}>
          {Array.from({ length: 2 }, (_, rowIndex) => (
            <View key={rowIndex} style={styles.bootRow}>
              {Array.from({ length: 2 }, (_, colIndex) => (
                <View key={colIndex} style={styles.bootGridCell}>
                  <View style={styles.bootCard}>
                    <SkeletonBlock width={56} height={56} borderRadius={16} />
                    <SkeletonBlock width="72%" height={14} borderRadius={4} />
                  </View>
                </View>
              ))}
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

export function ReportScreenSkeleton() {
  const { scrollBottom } = useSafePadding();

  return (
    <View style={[styles.listScreen, { paddingBottom: scrollBottom + 24 }]}>
      <SkeletonBlock width="88%" height={12} borderRadius={4} />
      <SkeletonBlock width="44%" height={12} borderRadius={4} style={styles.sectionLabel} />
      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <SkeletonBlock width="60%" height={11} borderRadius={4} />
          <SkeletonBlock width="80%" height={20} borderRadius={4} style={styles.summaryValue} />
        </View>
        <View style={styles.summaryCard}>
          <SkeletonBlock width="55%" height={11} borderRadius={4} />
          <SkeletonBlock width="70%" height={20} borderRadius={4} style={styles.summaryValue} />
        </View>
      </View>
      <SkeletonBlock width="38%" height={12} borderRadius={4} style={styles.sectionLabel} />
      <View style={styles.tableShell}>
        <View style={styles.tableHead}>
          {Array.from({ length: 3 }, (_, i) => (
            <SkeletonBlock key={i} width="28%" height={12} borderRadius={4} />
          ))}
        </View>
        {Array.from({ length: 5 }, (_, i) => (
          <View key={i} style={styles.tableRow}>
            {Array.from({ length: 3 }, (_, j) => (
              <SkeletonBlock key={j} width="26%" height={12} borderRadius={4} />
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  buttonShell: {
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  buttonShellPrimary: {
    backgroundColor: agro.forest,
  },
  buttonShellSecondary: {
    backgroundColor: agro.panel,
    borderWidth: 1,
    borderColor: agro.forest,
  },
  listScreen: {
    flex: 1,
    backgroundColor: agro.canvas,
    padding: 16,
    gap: 10,
  },
  listCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e2e8e0",
    gap: 8,
  },
  listCardAction: {
    marginTop: 2,
  },
  sectionLabel: {
    marginTop: 8,
  },
  field: {
    gap: 6,
  },
  tableShell: {
    borderWidth: 1,
    borderColor: "#e2e8e0",
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#fff",
  },
  tableHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 10,
    backgroundColor: "#f1f5f0",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8e0",
    gap: 8,
  },
  tableRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8e0",
    gap: 8,
  },
  summaryRow: {
    flexDirection: "row",
    gap: 10,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e2e8e0",
    gap: 8,
  },
  summaryValue: {
    marginTop: 4,
  },
  bootScreen: {
    flex: 1,
    backgroundColor: agro.panel,
  },
  bootTopPanel: {
    paddingHorizontal: 16,
    gap: 8,
  },
  bootHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
  },
  bootProfile: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 4,
    paddingBottom: 12,
  },
  bootProfileText: {
    flex: 1,
    gap: 8,
  },
  bootContentSheet: {
    flex: 1,
    backgroundColor: agroHomeSheet.backgroundColor,
    borderTopLeftRadius: agroHomeSheet.radius,
    borderTopRightRadius: agroHomeSheet.radius,
    overflow: "hidden",
    paddingHorizontal: 16,
  },
  bootTabs: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingTop: 16,
    paddingBottom: 12,
  },
  bootGrid: {
    paddingTop: 4,
    gap: 14,
  },
  bootRow: {
    flexDirection: "row",
    gap: 14,
  },
  bootGridCell: {
    flex: 1,
    minWidth: 0,
  },
  bootCard: {
    aspectRatio: 1,
    backgroundColor: agroHomeTile.backgroundColor,
    borderRadius: agroHomeTile.borderRadius,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
  },
  loginScreen: {
    flex: 1,
    backgroundColor: agro.cream,
    justifyContent: "center",
    padding: 24,
    gap: 12,
  },
  loginInput: {
    marginTop: 16,
  },
  loginButton: {
    marginTop: 8,
  },
});
