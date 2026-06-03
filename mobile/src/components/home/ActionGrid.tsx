import { Ionicons } from "@expo/vector-icons";
import { Link } from "expo-router";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import type { HomeAction } from "@/constants/home-actions";
import { agro, agroCardThemes, agroHomeTile } from "@/theme/agro";

const GRID_COLUMNS = 2;
const GRID_GAP = 14;
const GRID_PADDING = 16;

function chunkActions(actions: HomeAction[], columns: number): HomeAction[][] {
  const rows: HomeAction[][] = [];
  for (let i = 0; i < actions.length; i += columns) {
    rows.push(actions.slice(i, i + columns));
  }
  return rows;
}

function cardShadowStyle(shadowColor: string) {
  return Platform.select({
    ios: {
      shadowColor,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
    },
    android: { elevation: 3 },
    default: {
      shadowColor,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
    },
  });
}

function CardSurface(props: { action: HomeAction }) {
  const theme = agroCardThemes[props.action.tone];

  return (
    <View style={[styles.cardSurface, cardShadowStyle(theme.shadow)]}>
      <View style={styles.cardInner}>
        <View style={[styles.iconWrap, { backgroundColor: theme.iconBg }]}>
          <Ionicons name={props.action.icon} size={30} color={theme.iconFg} />
        </View>
        <Text style={styles.label} numberOfLines={2}>
          {props.action.label}
        </Text>
      </View>
    </View>
  );
}

function ActionGridCard(props: { action: HomeAction; onPress?: () => void }) {
  const { action } = props;

  if (props.onPress) {
    return (
      <Pressable
        onPress={props.onPress}
        style={({ pressed }) => [styles.cardHit, pressed && styles.cardHitPressed]}
        android_ripple={{ color: "rgba(45, 80, 22, 0.08)" }}
      >
        <CardSurface action={action} />
      </Pressable>
    );
  }

  if (action.href.startsWith("__")) {
    return (
      <Pressable
        onPress={undefined}
        disabled
        style={styles.cardHit}
      >
        <CardSurface action={action} />
      </Pressable>
    );
  }

  return (
    <Link href={action.href as never} asChild>
      <Pressable
        style={({ pressed }) => [styles.cardHit, pressed && styles.cardHitPressed]}
        android_ripple={{ color: "rgba(45, 80, 22, 0.08)" }}
      >
        <CardSurface action={action} />
      </Pressable>
    </Link>
  );
}

export function ActionGrid(props: {
  actions: HomeAction[];
  onAction?: (action: HomeAction) => void;
  emptyMessage?: string;
}) {
  if (props.actions.length === 0) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.empty}>
          {props.emptyMessage ?? "Nothing available for this tab."}
        </Text>
      </View>
    );
  }

  const rows = chunkActions(props.actions, GRID_COLUMNS);

  return (
    <View style={styles.grid}>
      {rows.map((row, rowIndex) => (
        <View key={`row-${rowIndex}`} style={styles.row}>
          {row.map((action) => (
            <View key={action.id} style={styles.cell}>
              <ActionGridCard
                action={action}
                onPress={
                  props.onAction && action.href.startsWith("__")
                    ? () => props.onAction!(action)
                    : undefined
                }
              />
            </View>
          ))}
          {row.length < GRID_COLUMNS
            ? Array.from({ length: GRID_COLUMNS - row.length }, (_, i) => (
                <View key={`spacer-${rowIndex}-${i}`} style={styles.cell} />
              ))
            : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    paddingHorizontal: GRID_PADDING,
    paddingTop: 16,
    paddingBottom: 8,
    gap: GRID_GAP,
  },
  row: {
    flexDirection: "row",
    gap: GRID_GAP,
  },
  cell: {
    flex: 1,
    minWidth: 0,
  },
  cardHit: {
    width: "100%",
  },
  cardHitPressed: {
    transform: [{ scale: 0.98 }],
  },
  cardSurface: {
    width: "100%",
    backgroundColor: "#ffffff",
    borderRadius: agroHomeTile.borderRadius,
    borderWidth: 1,
    borderColor: agro.borderLight,
    overflow: "hidden",
  },
  cardInner: {
    width: "100%",
    aspectRatio: 1,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 18,
    gap: 14,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: agro.text,
    textAlign: "center",
    lineHeight: 17,
  },
  emptyWrap: {
    padding: 32,
    alignItems: "center",
  },
  empty: {
    fontSize: 14,
    color: agro.textMuted,
    textAlign: "center",
  },
});
