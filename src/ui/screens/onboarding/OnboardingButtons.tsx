import { Pressable, Text } from "react-native";

import type { OnboardingFlowStyles } from "./onboarding-flow-styles";

type OnboardingButtonProps = {
  compact?: boolean;
  disabled?: boolean;
  grow?: boolean;
  label: string;
  onPress: () => void | Promise<void>;
  styles: OnboardingFlowStyles;
  testID?: string;
};

export function OnboardingPrimaryButton({
  compact = false,
  grow = false,
  label,
  onPress,
  disabled,
  styles,
  testID,
}: OnboardingButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.primaryButton,
        grow ? styles.buttonGrow : null,
        compact ? styles.primaryButtonCompact : null,
        disabled ? styles.buttonDisabled : null,
      ]}
      testID={testID}
    >
      <Text style={styles.primaryButtonText}>{label}</Text>
    </Pressable>
  );
}

export function OnboardingSecondaryButton({
  compact = false,
  grow = false,
  label,
  onPress,
  disabled,
  styles,
  testID,
}: OnboardingButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.secondaryButton,
        grow ? styles.buttonGrow : null,
        compact ? styles.secondaryButtonCompact : null,
        disabled ? styles.buttonDisabled : null,
      ]}
      testID={testID}
    >
      <Text style={styles.secondaryButtonText}>{label}</Text>
    </Pressable>
  );
}
