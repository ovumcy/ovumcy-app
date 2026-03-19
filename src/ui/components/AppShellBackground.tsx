import { useMemo } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";

import { useAppPreferences } from "../providers/AppPreferencesProvider";

export function AppShellBackground() {
  const { colors } = useAppPreferences();
  const { width, height } = useWindowDimensions();
  const stripeCount = useMemo(
    () => Math.max(Math.ceil((width + height) / 16), 42),
    [height, width],
  );

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: colors.background },
        ]}
      />
      <View
        style={[
          styles.glow,
          styles.glowPrimary,
          { backgroundColor: colors.bgGlowPrimary },
        ]}
      />
      <View
        style={[
          styles.glow,
          styles.glowSecondary,
          { backgroundColor: colors.bgGlowSecondary },
        ]}
      />
      <View style={styles.stripeLayer}>
        {Array.from({ length: stripeCount }).map((_, index) => (
          <View
            key={String(index)}
            style={[
              styles.stripe,
              {
                backgroundColor: colors.bgStripes,
                left: index * 16 - height * 0.45,
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  glow: {
    borderRadius: 9999,
    position: "absolute",
  },
  glowPrimary: {
    height: 320,
    left: -96,
    top: -88,
    width: 320,
  },
  glowSecondary: {
    height: 260,
    right: -72,
    top: -40,
    width: 260,
  },
  stripeLayer: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  stripe: {
    bottom: -260,
    position: "absolute",
    top: -260,
    transform: [{ rotate: "-45deg" }],
    width: 3,
  },
});
