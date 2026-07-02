import { Pressable, StyleSheet, Text } from "react-native";

import type { AppThemeColors } from "../theme/tokens";
import { useThemedStyles } from "../theme/useThemedStyles";

type AppButtonProps = {
  label: string;
  onPress: () => void | Promise<void>;
  disabled?: boolean;
  testID?: string;
  variant?: "primary" | "secondary" | "danger" | "danger_secondary";
};

export function AppButton({
  label,
  onPress,
  disabled = false,
  testID,
  variant = "primary",
}: AppButtonProps) {
  const styles = useThemedStyles(createStyles);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.base,
        variant === "primary"
          ? styles.primary
          : variant === "danger"
            ? styles.danger
            : variant === "danger_secondary"
              ? styles.dangerSecondary
            : styles.secondary,
        disabled ? styles.disabled : null,
      ]}
      testID={testID}
    >
      <Text
        style={[
          styles.label,
          variant === "primary"
            ? styles.primaryLabel
            : variant === "danger"
              ? styles.dangerLabel
              : variant === "danger_secondary"
                ? styles.dangerSecondaryLabel
              : styles.secondaryLabel,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const createStyles = (colors: AppThemeColors) =>
  StyleSheet.create({
  base: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    minHeight: 44,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  primary: {
    backgroundColor: colors.accent,
    borderColor: colors.accentStrong,
    shadowColor: colors.accentStrong,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
  },
  secondary: {
    backgroundColor: colors.surfaceTint,
    borderColor: colors.lineSoft,
  },
  danger: {
    backgroundColor: "#b91c1c",
    borderColor: "#991b1b",
  },
  dangerSecondary: {
    backgroundColor: colors.surface,
    borderColor: "rgba(185, 28, 28, 0.36)",
  },
  label: {
    fontSize: 14,
    fontWeight: "700",
  },
  primaryLabel: {
    color: colors.accentContrastText,
  },
  secondaryLabel: {
    color: colors.text,
  },
  dangerLabel: {
    color: "#ffffff",
  },
  dangerSecondaryLabel: {
    color: "#b91c1c",
  },
  disabled: {
    opacity: 0.6,
  },
  });
