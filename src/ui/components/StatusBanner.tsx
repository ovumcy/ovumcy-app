import { StyleSheet, Text, View } from "react-native";

import { colors, spacing } from "../theme/tokens";

type StatusBannerProps = {
  message: string;
  tone?: "success" | "error" | "info";
  testID?: string;
};

export function StatusBanner({
  message,
  tone = "info",
  testID,
}: StatusBannerProps) {
  if (!message) {
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
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    borderRadius: 14,
    borderWidth: 1,
    gap: spacing.xs,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  bannerSuccess: {
    backgroundColor: "rgba(244, 225, 205, 0.72)",
    borderColor: "rgba(186, 131, 80, 0.28)",
  },
  bannerError: {
    backgroundColor: "rgba(255, 244, 244, 0.96)",
    borderColor: "rgba(220, 38, 38, 0.22)",
  },
  bannerInfo: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
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
    backgroundColor: "rgba(255,255,255,0.68)",
    borderColor: "rgba(186, 131, 80, 0.24)",
    color: colors.accentStrong,
  },
  badgeError: {
    backgroundColor: "rgba(255,255,255,0.82)",
    borderColor: "rgba(185, 28, 28, 0.18)",
    color: "#b42318",
  },
  badgeInfo: {
    backgroundColor: "rgba(255,255,255,0.78)",
    borderColor: "rgba(188, 165, 138, 0.24)",
    color: colors.textMuted,
  },
  message: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
});
