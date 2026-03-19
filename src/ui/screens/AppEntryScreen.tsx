import { useRouter } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { getShellCopy } from "../../i18n/shell-copy";
import {
  appStorage,
  resolveInitialEntryHref,
} from "../../services/app-bootstrap-service";
import type { LocalAppStorage } from "../../storage/local/storage-contract";
import { BrandLockup } from "../components/BrandLockup";
import { AppScreenSurface } from "../components/AppScreenSurface";
import { useAppPreferences } from "../providers/AppPreferencesProvider";
import type { AppThemeColors } from "../theme/tokens";
import { spacing } from "../theme/tokens";
import { useThemedStyles } from "../theme/useThemedStyles";

type AppEntryScreenProps = {
  storage?: LocalAppStorage;
};

export function AppEntryScreen({
  storage = appStorage,
}: AppEntryScreenProps) {
  const { colors, language } = useAppPreferences();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const styles = useThemedStyles(createStyles);
  const shellCopy = getShellCopy(language);

  useEffect(() => {
    let isMounted = true;

    void resolveInitialEntryHref(storage).then((href) => {
      if (!isMounted) {
        return;
      }

      router.replace(href);
    });

    return () => {
      isMounted = false;
    };
  }, [router, storage]);

  return (
    <AppScreenSurface>
      <View style={styles.screen}>
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <BrandLockup />
        </View>
        <View style={styles.content}>
          <View style={styles.card}>
            <Text style={styles.kicker}>OVUMCY</Text>
            <Text style={styles.title}>{shellCopy.loading.appShellTitle}</Text>
            <Text style={styles.description}>
              {shellCopy.loading.appShellDescription}
            </Text>
            <View style={styles.spinnerRow}>
              <ActivityIndicator color={colors.accent} size="large" />
            </View>
          </View>
        </View>
      </View>
    </AppScreenSurface>
  );
}

const createStyles = (colors: AppThemeColors) =>
  StyleSheet.create({
    screen: {
      backgroundColor: "transparent",
      flex: 1,
    },
    header: {
      backgroundColor: colors.headerBg,
      borderBottomColor: colors.headerBorder,
      borderBottomWidth: 1,
      paddingHorizontal: 20,
      paddingBottom: 12,
    },
    content: {
      alignItems: "center",
      flex: 1,
      justifyContent: "center",
      paddingHorizontal: 20,
      paddingVertical: spacing.xl,
    },
    card: {
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.lineSoft,
      borderRadius: 24,
      borderWidth: 1,
      gap: spacing.sm,
      maxWidth: 760,
      padding: 40,
      shadowColor: colors.shadowStrong,
      shadowOffset: { width: 0, height: 18 },
      shadowOpacity: 0.9,
      shadowRadius: 30,
      width: "100%",
    },
    kicker: {
      color: colors.accentStrong,
      fontSize: 14,
      fontWeight: "800",
      letterSpacing: 1.4,
      textTransform: "uppercase",
    },
    title: {
      color: colors.text,
      fontSize: 38,
      fontWeight: "800",
      lineHeight: 44,
    },
    description: {
      color: colors.textMuted,
      fontSize: 18,
      lineHeight: 28,
      maxWidth: 520,
    },
    spinnerRow: {
      alignItems: "center",
      paddingTop: spacing.lg,
      paddingBottom: spacing.sm,
    },
  });
