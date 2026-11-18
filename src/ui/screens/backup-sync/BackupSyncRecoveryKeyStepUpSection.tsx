import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import type { RecoveryKeyStepUpCopy } from "../../../i18n/recovery-key-stepup-copy";
import type { SyncRecoveryKeyStepUp } from "../../../sync/sync-api-client";
import { AppButton } from "../../components/AppButton";
import { AppTextInput } from "../../components/AppTextInput";
import { FeatureCard } from "../../components/FeatureCard";
import { StatusBanner } from "../../components/StatusBanner";
import type { AppThemeColors } from "../../theme/tokens";
import { spacing } from "../../theme/tokens";
import { useThemedStyles } from "../../theme/useThemedStyles";
import type { RecoveryKeyStepUpPrompt } from "./useBackupSyncActions";

export type BackupSyncRecoveryKeyStepUpSectionProps = {
  copy: RecoveryKeyStepUpCopy;
  isBusy: boolean;
  onCancel: () => void;
  onSubmit: (stepUp: SyncRecoveryKeyStepUp) => void | Promise<void>;
  prompt: RecoveryKeyStepUpPrompt;
  // Also renders the account-deletion step-up; each use keeps its own testIDs.
  testIDPrefix?: string;
};

/**
 * The password and code live only in this component's state: cleared right
 * after submit, on cancel and on unmount, and never stored, logged or routed.
 */
export function BackupSyncRecoveryKeyStepUpSection({
  copy,
  isBusy,
  onCancel,
  onSubmit,
  prompt,
  testIDPrefix = "sync-recovery-key-stepup",
}: BackupSyncRecoveryKeyStepUpSectionProps) {
  const styles = useThemedStyles(createStyles);
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");

  function clearFields() {
    setPassword("");
    setCode("");
  }

  function handleSubmit() {
    const stepUp: SyncRecoveryKeyStepUp = prompt.codeRequired
      ? { currentPassword: password, code }
      : { currentPassword: password };
    clearFields();
    void onSubmit(stepUp);
  }

  function handleCancel() {
    clearFields();
    onCancel();
  }

  const errorMessage = resolveErrorMessage(prompt.errorCode, copy);

  return (
    <FeatureCard title={copy.title}>
      <Text style={styles.helperText}>{copy.explanation}</Text>
      <Text style={styles.fieldLabel}>{copy.passwordLabel}</Text>
      <AppTextInput
        accessibilityLabel={copy.passwordLabel}
        autoCapitalize="none"
        autoComplete="current-password"
        autoCorrect={false}
        onChangeText={setPassword}
        secureTextEntry
        style={styles.input}
        testID={`${testIDPrefix}-password`}
        textContentType="password"
        value={password}
      />
      {prompt.codeRequired ? (
        <>
          <Text style={styles.fieldLabel}>{copy.codeLabel}</Text>
          <AppTextInput
            accessibilityLabel={copy.codeLabel}
            autoCapitalize="none"
            autoComplete="one-time-code"
            autoCorrect={false}
            keyboardType="number-pad"
            maxLength={6}
            onChangeText={setCode}
            style={styles.input}
            testID={`${testIDPrefix}-code`}
            textContentType="oneTimeCode"
            value={code}
          />
        </>
      ) : null}
      {errorMessage ? (
        <StatusBanner
          message={errorMessage}
          testID={`${testIDPrefix}-error`}
          tone="error"
        />
      ) : null}
      <View style={styles.actions}>
        <AppButton
          disabled={isBusy || password.length === 0 || !isSendableCode(code)}
          label={copy.confirmLabel}
          onPress={handleSubmit}
          testID={`${testIDPrefix}-confirm`}
        />
        <AppButton
          disabled={isBusy}
          label={copy.cancelLabel}
          onPress={handleCancel}
          testID={`${testIDPrefix}-cancel`}
          variant="secondary"
        />
      </View>
    </FeatureCard>
  );
}

// An empty code is allowed: the field also shows when the 2FA status is
// unknown, and an empty code is not sent.
function isSendableCode(code: string): boolean {
  const trimmed = code.trim();
  return trimmed.length === 0 || /^\d{6}$/.test(trimmed);
}

function resolveErrorMessage(
  errorCode: RecoveryKeyStepUpPrompt["errorCode"],
  copy: RecoveryKeyStepUpCopy,
): string {
  switch (errorCode) {
    case "invalid_current_password":
      return copy.errors.invalidCurrentPassword;
    case "totp_invalid_code":
      return copy.errors.totpInvalidCode;
    case "totp_replayed":
      return copy.errors.totpReplayed;
    case "rate_limited":
      return copy.errors.rateLimited;
    default:
      return "";
  }
}

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    helperText: {
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 20,
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
