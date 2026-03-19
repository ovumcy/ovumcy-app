import { Pressable, StyleSheet, Text } from "react-native";

import type { AppThemeColors } from "../theme/tokens";
import { useThemedStyles } from "../theme/useThemedStyles";

type AppButtonProps = {
  label: string;
  onPress: () => void | Promise<void>;
  disabled?: boolean;
  testID?: string;
  variant?: "primary" | "secondary" | "danger";
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
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.base,
        variant === "primary"
          ? styles.primary
          : variant === "danger"
            ? styles.danger
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
  label: {
    fontSize: 14,
    fontWeight: "700",
  },
  primaryLabel: {
    color: "#ffffff",
  },
  secondaryLabel: {
    color: colors.text,
  },
  dangerLabel: {
    color: "#ffffff",
  },
  disabled: {
    opacity: 0.6,
  },
  });
