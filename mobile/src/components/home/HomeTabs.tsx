import { Pressable, StyleSheet, Text, View } from "react-native";
import type { HomeTabId } from "@/constants/home-actions";
import { agro, agroHomeSheet } from "@/theme/agro";

export function HomeTabs(props: {
  tabs: Array<{ id: HomeTabId; label: string }>;
  active: HomeTabId;
  onChange: (id: HomeTabId) => void;
}) {
  return (
    <View style={styles.wrap}>
      {props.tabs.map((tab) => {
        const active = tab.id === props.active;
        return (
          <Pressable
            key={tab.id}
            style={styles.tab}
            onPress={() => props.onChange(tab.id)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.label, active && styles.labelActive]}>{tab.label}</Text>
            {active ? <View style={styles.indicator} /> : <View style={styles.indicatorSpacer} />}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    backgroundColor: agroHomeSheet.backgroundColor,
    paddingTop: 4,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingTop: 14,
    paddingBottom: 0,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: agro.textSoft,
    paddingBottom: 12,
  },
  labelActive: {
    color: agro.text,
    fontWeight: "700",
  },
  indicator: {
    height: 3,
    width: "78%",
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
    backgroundColor: agro.forest,
  },
  indicatorSpacer: {
    height: 3,
  },
});
