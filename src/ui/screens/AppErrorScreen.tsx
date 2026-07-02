import { Pressable, StyleSheet, Text, View } from "react-native";

import { getErrorCopy } from "../../i18n/error-copy";
import { resolveDeviceLanguage } from "../../i18n/runtime";
import { lightColors, spacing } from "../theme/tokens";

type AppErrorScreenProps = {
  message: string;
  onRetry: () => void;
};

// This screen renders when the root app tree — including
// AppPreferencesProvider — has already crashed, so it cannot depend on any
// React context (no useThemedStyles, no useAppPreferences). It uses a
// static light theme and reads the device locale directly instead.
export function AppErrorScreen({ message, onRetry }: AppErrorScreenProps) {
  const copy = getErrorCopy(resolveDeviceLanguage());

  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        <Text style={styles.title}>{copy.title}</Text>
        <Text style={styles.description}>{copy.description}</Text>
        <View style={styles.detailsBlock}>
          <Text style={styles.detailsLabel}>{copy.detailsLabel}</Text>
          {/* Message only — never render a stack trace here. */}
          <Text style={styles.detailsMessage}>{message}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={onRetry}
          style={styles.retryButton}
        >
          <Text style={styles.retryLabel}>{copy.retryAction}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    alignItems: "center",
    backgroundColor: lightColors.background,
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: spacing.xl,
  },
  card: {
    backgroundColor: lightColors.surfaceElevated,
    borderColor: lightColors.lineSoft,
    borderRadius: 24,
    borderWidth: 1,
    gap: spacing.sm,
    maxWidth: 480,
    padding: 24,
    width: "100%",
  },
  title: {
    color: lightColors.text,
    fontSize: 22,
    fontWeight: "800",
  },
  description: {
    color: lightColors.textMuted,
    fontSize: 15,
    lineHeight: 22,
  },
  detailsBlock: {
    backgroundColor: lightColors.surfaceMuted,
    borderColor: lightColors.border,
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
    padding: 12,
  },
  detailsLabel: {
    color: lightColors.textMuted,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  detailsMessage: {
    color: lightColors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  retryButton: {
    alignItems: "center",
    backgroundColor: lightColors.accent,
    borderColor: lightColors.accentStrong,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  retryLabel: {
    color: lightColors.accentContrastText,
    fontSize: 14,
    fontWeight: "700",
  },
});
