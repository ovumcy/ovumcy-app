import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import type { AppThemeColors } from "../theme/tokens";
import { spacing } from "../theme/tokens";
import { useThemedStyles } from "../theme/useThemedStyles";

type StatusBannerProps = {
  autoDismissAfterMs?: number;
  message: string;
  tone?: "success" | "error" | "info";
  testID?: string;
};

export function StatusBanner({
  autoDismissAfterMs,
  message,
  tone = "info",
  testID,
}: StatusBannerProps) {
  const styles = useThemedStyles(createStyles);
  const [isVisible, setIsVisible] = useState(Boolean(message));
  const dismissAfterMs =
    autoDismissAfterMs ?? (tone === "success" ? 2800 : undefined);

  useEffect(() => {
    setIsVisible(Boolean(message));
  }, [message]);

  useEffect(() => {
    if (!message || !dismissAfterMs || dismissAfterMs <= 0) {
      return;
    }

    const timeout = setTimeout(() => {
      setIsVisible(false);
    }, dismissAfterMs);

    return () => clearTimeout(timeout);
  }, [dismissAfterMs, message]);

  if (!message || !isVisible) {
    return null;
  }

  return (
    <View
      style={[
        styles.banner,
        tone === "success"
          ? styles.bannerSuccess
          : tone === "error"
            ? styles.bannerError
            : styles.bannerInfo,
      ]}
      testID={testID}
    >
      <Text
        style={[
          styles.badge,
          tone === "success"
            ? styles.badgeSuccess
            : tone === "error"
              ? styles.badgeError
              : styles.badgeInfo,
        ]}
      >
        {tone === "success" ? "Done" : tone === "error" ? "Error" : "Info"}
      </Text>
      <Text
        style={[
          styles.message,
          tone === "success"
            ? styles.messageSuccess
            : tone === "error"
              ? styles.messageError
              : null,
        ]}
      >
        {message}
      </Text>
    </View>
  );
}

const createStyles = (colors: AppThemeColors) =>
  StyleSheet.create({
  banner: {
    borderRadius: 14,
    borderWidth: 1,
    gap: spacing.xs,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  bannerSuccess: {
    backgroundColor: colors.statusSuccessBg,
    borderColor: colors.statusSuccessBorder,
  },
  bannerError: {
    backgroundColor: colors.statusErrorBg,
    borderColor: colors.statusErrorBorder,
  },
  bannerInfo: {
    backgroundColor: colors.statusInfoBg,
    borderColor: colors.statusInfoBorder,
  },
  badge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    textTransform: "uppercase",
  },
  badgeSuccess: {
    backgroundColor: colors.statusSuccessBadgeBg,
    borderColor: colors.statusSuccessBorder,
    color: colors.statusSuccessText,
  },
  badgeError: {
    backgroundColor: colors.statusErrorBadgeBg,
    borderColor: colors.statusErrorBorder,
    color: colors.statusErrorText,
  },
  badgeInfo: {
    backgroundColor: colors.statusInfoBadgeBg,
    borderColor: colors.statusInfoBorder,
    color: colors.textMuted,
  },
  message: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  messageSuccess: {
    color: colors.statusSuccessText,
  },
  messageError: {
    color: colors.statusErrorText,
  },
  });
