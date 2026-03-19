import type { PropsWithChildren } from "react";
import { StyleSheet, View } from "react-native";

import { useAppPreferences } from "../providers/AppPreferencesProvider";
import { AppShellBackground } from "./AppShellBackground";

export function AppScreenSurface({ children }: PropsWithChildren) {
  const { colors } = useAppPreferences();

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <AppShellBackground />
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    flex: 1,
    zIndex: 1,
  },
});
