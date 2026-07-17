import { StyleSheet, Text, View } from "react-native";

import type { TOTPCopy } from "../../../i18n/totp-copy";
import { AppButton } from "../../components/AppButton";
import { AppTextInput } from "../../components/AppTextInput";
import { FeatureCard } from "../../components/FeatureCard";
import { StatusBanner } from "../../components/StatusBanner";
import type { AppThemeColors } from "../../theme/tokens";
import { spacing } from "../../theme/tokens";
import { useThemedStyles } from "../../theme/useThemedStyles";

export type BackupSyncTOTPChallengeSectionProps = {
  challengeExpiresAt: string;
  code: string;
  copy: TOTPCopy;
  errorMessage: string;
  onCancel: () => void;
  onCodeChange: (value: string) => void;
  onSubmit: () => void | Promise<void>;
};

/**
 * BackupSyncTOTPChallengeSection renders the inline 6-digit prompt shown after
 * a password-only login response that came back with a `totp_challenge`. The
 * challenge id is held by the parent controller in memory only; this view is
 * intentionally a thin presentational form so that the lifetime of the
 * challenge stays bounded by the screen state.
 */
export function BackupSyncTOTPChallengeSection({
  challengeExpiresAt,
  code,
  copy,
  errorMessage,
  onCancel,
  onCodeChange,
  onSubmit,
}: BackupSyncTOTPChallengeSectionProps) {
  const styles = useThemedStyles(createStyles);

  return (
    <FeatureCard title={copy.challenge.title}>
      <Text style={styles.helperText}>{copy.challenge.hint}</Text>
      {challengeExpiresAt ? (
        <Text style={styles.expiresText} testID="backup-sync-totp-expires">
          {challengeExpiresAt}
        </Text>
      ) : null}
      <Text style={styles.fieldLabel}>{copy.challenge.codeLabel}</Text>
      <AppTextInput
        accessibilityLabel={copy.challenge.codeLabel}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="number-pad"
        onChangeText={onCodeChange}
        style={styles.input}
        testID="backup-sync-totp-challenge-code"
        value={code}
      />
      {errorMessage ? (
        <StatusBanner
          message={errorMessage}
          testID="backup-sync-totp-challenge-error"
          tone="error"
        />
      ) : null}
      <View style={styles.actions}>
        <AppButton
          label={copy.challenge.submitLabel}
          onPress={onSubmit}
          testID="backup-sync-totp-challenge-submit"
        />
        <AppButton
          label={copy.challenge.cancelLabel}
          onPress={onCancel}
          testID="backup-sync-totp-challenge-cancel"
          variant="secondary"
        />
      </View>
    </FeatureCard>
  );
}

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    helperText: {
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 20,
    },
    expiresText: {
      color: colors.textMuted,
      fontSize: 12,
      fontFamily: "monospace",
    },
    fieldLabel: {
      color: colors.text,
      fontSize: 14,
      marginTop: spacing.sm,
    },
    input: {
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.border,
      borderRadius: 8,
      borderWidth: 1,
      fontSize: 16,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    actions: {
      gap: spacing.sm,
    },
  });
}
