import {
  Modal,
  StyleSheet,
  Text,
  View,
} from "react-native";

import type {
  AccountSecurityCopy,
} from "../../../i18n/account-security-copy";
import type { TOTPCopy } from "../../../i18n/totp-copy";
import type {
  ChangeSyncPasswordErrorCode,
  RegenerateSyncRecoveryCodeErrorCode,
  RequestSyncPasswordResetErrorCode,
  ResetSyncPasswordErrorCode,
} from "../../../sync/sync-account-recovery-service";
import type { SyncTOTPEnrollmentStart } from "../../../sync/sync-contract";
import type {
  DisableTOTPErrorCode,
  StartTOTPEnrollmentErrorCode,
  VerifyTOTPEnrollmentErrorCode,
} from "../../../sync/sync-totp-service";
import { AppButton } from "../../components/AppButton";
import { AppTextInput } from "../../components/AppTextInput";
import { FeatureCard } from "../../components/FeatureCard";
import { StatusBanner } from "../../components/StatusBanner";
import type { AppThemeColors } from "../../theme/tokens";
import { spacing } from "../../theme/tokens";
import { useThemedStyles } from "../../theme/useThemedStyles";
import type {
  SyncAccountSecurityForgotStage,
  SyncAccountSecurityStatus,
  SyncAccountSecurityTOTPMode,
  SyncAccountSecurityTOTPStage,
} from "./useSyncAccountSecurityController";

type AnyErrorCode =
  | ChangeSyncPasswordErrorCode
  | RegenerateSyncRecoveryCodeErrorCode
  | RequestSyncPasswordResetErrorCode
  | ResetSyncPasswordErrorCode;

type TOTPErrorCode =
  | StartTOTPEnrollmentErrorCode
  | VerifyTOTPEnrollmentErrorCode
  | DisableTOTPErrorCode;

export type SyncAccountSecuritySectionProps = {
  copy: AccountSecurityCopy;

  changeCurrentPassword: string;
  onChangeCurrentPasswordChange: (value: string) => void;
  changeNewPassword: string;
  onChangeNewPasswordChange: (value: string) => void;
  changeStatus: SyncAccountSecurityStatus;
  changeErrorCode: ChangeSyncPasswordErrorCode | null;
  onChangePassword: () => void | Promise<void>;

  forgotLogin: string;
  onForgotLoginChange: (value: string) => void;
  forgotRecoveryCode: string;
  onForgotRecoveryCodeChange: (value: string) => void;
  forgotNewPassword: string;
  onForgotNewPasswordChange: (value: string) => void;
  forgotStage: SyncAccountSecurityForgotStage;
  forgotStatus: SyncAccountSecurityStatus;
  forgotErrorCode:
    | RequestSyncPasswordResetErrorCode
    | ResetSyncPasswordErrorCode
    | null;
  forgotResetTokenExpiresAt: string;
  onRequestReset: () => void | Promise<void>;
  onSubmitResetPassword: () => void | Promise<void>;
  onCancelForgot: () => void;

  regeneratePassword: string;
  onRegeneratePasswordChange: (value: string) => void;
  regenerateStatus: SyncAccountSecurityStatus;
  regenerateErrorCode: RegenerateSyncRecoveryCodeErrorCode | null;
  onRegenerate: () => void | Promise<void>;

  revealedRecoveryCode: string;
  onAcknowledgeRecoveryCode: () => void;

  totpCopy: TOTPCopy;
  totpMode: SyncAccountSecurityTOTPMode;
  onTOTPModeChange: (mode: SyncAccountSecurityTOTPMode) => void;
  totpStage: SyncAccountSecurityTOTPStage;
  totpEnrollPassword: string;
  onTOTPEnrollPasswordChange: (value: string) => void;
  totpEnrollment: SyncTOTPEnrollmentStart | null;
  totpVerifyCode: string;
  onTOTPVerifyCodeChange: (value: string) => void;
  totpDisablePassword: string;
  onTOTPDisablePasswordChange: (value: string) => void;
  totpDisableCode: string;
  onTOTPDisableCodeChange: (value: string) => void;
  totpStatus: SyncAccountSecurityStatus;
  totpErrorCode: TOTPErrorCode | null;
  onStartTOTPEnrollment: () => void | Promise<void>;
  onVerifyTOTPEnrollment: () => void | Promise<void>;
  onDisableTOTP: () => void | Promise<void>;
  onCancelTOTPEnrollment: () => void;
};

export function SyncAccountSecuritySection({
  copy,
  changeCurrentPassword,
  onChangeCurrentPasswordChange,
  changeNewPassword,
  onChangeNewPasswordChange,
  changeStatus,
  changeErrorCode,
  onChangePassword,
  forgotLogin,
  onForgotLoginChange,
  forgotRecoveryCode,
  onForgotRecoveryCodeChange,
  forgotNewPassword,
  onForgotNewPasswordChange,
  forgotStage,
  forgotStatus,
  forgotErrorCode,
  forgotResetTokenExpiresAt,
  onRequestReset,
  onSubmitResetPassword,
  onCancelForgot,
  regeneratePassword,
  onRegeneratePasswordChange,
  regenerateStatus,
  regenerateErrorCode,
  onRegenerate,
  revealedRecoveryCode,
  onAcknowledgeRecoveryCode,
  totpCopy,
  totpMode,
  onTOTPModeChange,
  totpStage,
  totpEnrollPassword,
  onTOTPEnrollPasswordChange,
  totpEnrollment,
  totpVerifyCode,
  onTOTPVerifyCodeChange,
  totpDisablePassword,
  onTOTPDisablePasswordChange,
  totpDisableCode,
  onTOTPDisableCodeChange,
  totpStatus,
  totpErrorCode,
  onStartTOTPEnrollment,
  onVerifyTOTPEnrollment,
  onDisableTOTP,
  onCancelTOTPEnrollment,
}: SyncAccountSecuritySectionProps) {
  const styles = useThemedStyles(createStyles);
  const isRevealVisible = revealedRecoveryCode.length > 0;

  return (
    <View style={styles.stack}>
      <FeatureCard title={copy.changePassword.title}>
        <Text style={styles.helperText}>{copy.changePassword.hint}</Text>
        <Text style={styles.fieldLabel}>
          {copy.changePassword.currentPasswordLabel}
        </Text>
        <AppTextInput
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={onChangeCurrentPasswordChange}
          secureTextEntry
          style={styles.input}
          testID="account-security-change-current-password"
          value={changeCurrentPassword}
        />
        <Text style={styles.fieldLabel}>
          {copy.changePassword.newPasswordLabel}
        </Text>
        <AppTextInput
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={onChangeNewPasswordChange}
          secureTextEntry
          style={styles.input}
          testID="account-security-change-new-password"
          value={changeNewPassword}
        />
        {changeErrorCode ? (
          <StatusBanner
            message={resolveErrorMessage(copy, changeErrorCode)}
            testID="account-security-change-error-banner"
            tone="error"
          />
        ) : null}
        {changeStatus === "success" ? (
          <StatusBanner
            message={copy.changePassword.successMessage}
            testID="account-security-change-success-banner"
            tone="success"
          />
        ) : null}
        <AppButton
          disabled={changeStatus === "submitting"}
          label={copy.changePassword.submitLabel}
          onPress={onChangePassword}
          testID="account-security-change-submit"
        />
      </FeatureCard>

      <FeatureCard title={copy.forgotPassword.title}>
        {forgotStage === "credentials" ? (
          <>
            <Text style={styles.helperText}>{copy.forgotPassword.hint}</Text>
            <Text style={styles.fieldLabel}>
              {copy.forgotPassword.loginLabel}
            </Text>
            <AppTextInput
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              onChangeText={onForgotLoginChange}
              style={styles.input}
              testID="account-security-forgot-login"
              value={forgotLogin}
            />
            <Text style={styles.fieldLabel}>
              {copy.forgotPassword.recoveryCodeLabel}
            </Text>
            <AppTextInput
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={onForgotRecoveryCodeChange}
              style={styles.input}
              testID="account-security-forgot-recovery-code"
              value={forgotRecoveryCode}
            />
            {forgotErrorCode ? (
              <StatusBanner
                message={resolveErrorMessage(copy, forgotErrorCode)}
                testID="account-security-forgot-error-banner"
                tone="error"
              />
            ) : null}
            <AppButton
              disabled={forgotStatus === "submitting"}
              label={copy.forgotPassword.submitLabel}
              onPress={onRequestReset}
              testID="account-security-forgot-submit"
            />
          </>
        ) : forgotStage === "new_password" ? (
          <>
            <Text style={styles.subheading}>
              {copy.forgotPassword.stageTwoTitle}
            </Text>
            <Text style={styles.helperText}>
              {copy.forgotPassword.stageTwoHint}
            </Text>
            {forgotResetTokenExpiresAt ? (
              <Text style={styles.helperText}>
                {forgotResetTokenExpiresAt}
              </Text>
            ) : null}
            <Text style={styles.fieldLabel}>
              {copy.forgotPassword.newPasswordLabel}
            </Text>
            <AppTextInput
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={onForgotNewPasswordChange}
              secureTextEntry
              style={styles.input}
              testID="account-security-forgot-new-password"
              value={forgotNewPassword}
            />
            {forgotErrorCode ? (
              <StatusBanner
                message={resolveErrorMessage(copy, forgotErrorCode)}
                testID="account-security-forgot-error-banner"
                tone="error"
              />
            ) : null}
            <AppButton
              disabled={forgotStatus === "submitting"}
              label={copy.forgotPassword.submitResetLabel}
              onPress={onSubmitResetPassword}
              testID="account-security-forgot-reset-submit"
            />
            <AppButton
              label={copy.forgotPassword.cancelLabel}
              onPress={onCancelForgot}
              testID="account-security-forgot-cancel"
              variant="secondary"
            />
          </>
        ) : (
          <StatusBanner
            message={copy.forgotPassword.completedMessage}
            testID="account-security-forgot-completed-banner"
            tone="success"
          />
        )}
      </FeatureCard>

      <FeatureCard title={copy.regenerate.title}>
        <Text style={styles.helperText}>{copy.regenerate.hint}</Text>
        <Text style={styles.fieldLabel}>
          {copy.regenerate.currentPasswordLabel}
        </Text>
        <AppTextInput
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={onRegeneratePasswordChange}
          secureTextEntry
          style={styles.input}
          testID="account-security-regenerate-password"
          value={regeneratePassword}
        />
        {regenerateErrorCode ? (
          <StatusBanner
            message={resolveErrorMessage(copy, regenerateErrorCode)}
            testID="account-security-regenerate-error-banner"
            tone="error"
          />
        ) : null}
        <AppButton
          disabled={regenerateStatus === "submitting"}
          label={copy.regenerate.submitLabel}
          onPress={onRegenerate}
          testID="account-security-regenerate-submit"
        />
      </FeatureCard>

      <FeatureCard title={totpCopy.section.title}>
        <Text style={styles.helperText}>{totpCopy.section.hint}</Text>
        <View style={styles.totpTabs} testID="account-security-totp-tabs">
          <AppButton
            label={totpCopy.section.enableTab}
            onPress={() => onTOTPModeChange("enable")}
            testID="account-security-totp-tab-enable"
            variant={totpMode === "enable" ? "primary" : "secondary"}
          />
          <AppButton
            label={totpCopy.section.disableTab}
            onPress={() => onTOTPModeChange("disable")}
            testID="account-security-totp-tab-disable"
            variant={totpMode === "disable" ? "primary" : "secondary"}
          />
        </View>

        {totpMode === "enable" ? (
          totpStage === "idle" ? (
            <>
              <Text style={styles.fieldLabel}>
                {totpCopy.enroll.currentPasswordLabel}
              </Text>
              <AppTextInput
                autoCapitalize="none"
                autoCorrect={false}
                onChangeText={onTOTPEnrollPasswordChange}
                secureTextEntry
                style={styles.input}
                testID="account-security-totp-enroll-password"
                value={totpEnrollPassword}
              />
              {totpErrorCode ? (
                <StatusBanner
                  message={resolveTOTPErrorMessage(totpCopy, totpErrorCode)}
                  testID="account-security-totp-error-banner"
                  tone="error"
                />
              ) : null}
              <AppButton
                disabled={totpStatus === "submitting"}
                label={totpCopy.enroll.startLabel}
                onPress={onStartTOTPEnrollment}
                testID="account-security-totp-enroll-submit"
              />
            </>
          ) : totpStage === "enrolling" && totpEnrollment ? (
            <>
              <Text style={styles.subheading}>
                {totpCopy.enroll.secretTitle}
              </Text>
              <Text style={styles.helperText}>{totpCopy.enroll.secretHint}</Text>
              <Text style={styles.fieldLabel}>
                {totpCopy.enroll.secretManualLabel}
              </Text>
              <View style={styles.codeCard}>
                <Text
                  selectable
                  style={styles.codeText}
                  testID="account-security-totp-secret-value"
                >
                  {totpEnrollment.secretBase32}
                </Text>
              </View>
              <Text style={styles.fieldLabel}>
                {totpCopy.enroll.provisioningUriLabel}
              </Text>
              <View style={styles.codeCard}>
                <Text
                  selectable
                  style={styles.uriText}
                  testID="account-security-totp-provisioning-uri"
                >
                  {totpEnrollment.provisioningURI}
                </Text>
              </View>
              <Text style={styles.fieldLabel}>{totpCopy.enroll.codeLabel}</Text>
              <AppTextInput
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="number-pad"
                onChangeText={onTOTPVerifyCodeChange}
                style={styles.input}
                testID="account-security-totp-verify-code"
                value={totpVerifyCode}
              />
              {totpErrorCode ? (
                <StatusBanner
                  message={resolveTOTPErrorMessage(totpCopy, totpErrorCode)}
                  testID="account-security-totp-error-banner"
                  tone="error"
                />
              ) : null}
              <AppButton
                disabled={totpStatus === "submitting"}
                label={totpCopy.enroll.verifyLabel}
                onPress={onVerifyTOTPEnrollment}
                testID="account-security-totp-verify-submit"
              />
              <AppButton
                label={totpCopy.enroll.cancelLabel}
                onPress={onCancelTOTPEnrollment}
                testID="account-security-totp-cancel"
                variant="secondary"
              />
            </>
          ) : (
            <StatusBanner
              message={totpCopy.enroll.successMessage}
              testID="account-security-totp-success-banner"
              tone="success"
            />
          )
        ) : totpStage === "completed" ? (
          <StatusBanner
            message={totpCopy.disable.successMessage}
            testID="account-security-totp-success-banner"
            tone="success"
          />
        ) : (
          <>
            <Text style={styles.fieldLabel}>
              {totpCopy.disable.currentPasswordLabel}
            </Text>
            <AppTextInput
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={onTOTPDisablePasswordChange}
              secureTextEntry
              style={styles.input}
              testID="account-security-totp-disable-password"
              value={totpDisablePassword}
            />
            <Text style={styles.fieldLabel}>{totpCopy.disable.codeLabel}</Text>
            <AppTextInput
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="number-pad"
              onChangeText={onTOTPDisableCodeChange}
              style={styles.input}
              testID="account-security-totp-disable-code"
              value={totpDisableCode}
            />
            {totpErrorCode ? (
              <StatusBanner
                message={resolveTOTPErrorMessage(totpCopy, totpErrorCode)}
                testID="account-security-totp-error-banner"
                tone="error"
              />
            ) : null}
            <AppButton
              disabled={totpStatus === "submitting"}
              label={totpCopy.disable.submitLabel}
              onPress={onDisableTOTP}
              testID="account-security-totp-disable-submit"
            />
          </>
        )}
      </FeatureCard>

      <Modal
        animationType="fade"
        onRequestClose={onAcknowledgeRecoveryCode}
        transparent
        visible={isRevealVisible}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={styles.modalCard}
            testID="account-security-recovery-code-modal"
          >
            <Text style={styles.modalTitle}>{copy.reveal.title}</Text>
            <Text style={styles.helperText}>{copy.reveal.hint}</Text>
            <View style={styles.codeCard}>
              <Text
                selectable
                style={styles.codeText}
                testID="account-security-recovery-code-value"
              >
                {revealedRecoveryCode}
              </Text>
            </View>
            <AppButton
              label={copy.reveal.confirmLabel}
              onPress={onAcknowledgeRecoveryCode}
              testID="account-security-recovery-code-confirm"
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

function resolveTOTPErrorMessage(
  copy: TOTPCopy,
  code: TOTPErrorCode,
): string {
  switch (code) {
    case "current_password_required":
      return copy.errors.currentPasswordRequired;
    case "code_required":
      return copy.errors.codeRequired;
    case "invalid_current_password":
      return copy.errors.invalidCurrentPassword;
    case "totp_not_configured":
      return copy.errors.totpNotConfigured;
    case "totp_already_enabled":
      return copy.errors.totpAlreadyEnabled;
    case "totp_invalid_code":
      return copy.errors.totpInvalidCode;
    case "totp_replayed":
      return copy.errors.totpReplayed;
    case "totp_secret_failed":
      return copy.errors.totpSecretFailed;
    case "not_connected":
      return copy.errors.notConnected;
    case "rate_limited":
      return copy.errors.rateLimited;
    case "network_failed":
      return copy.errors.networkFailed;
    case "unauthorized":
      return copy.errors.unauthorized;
    default:
      return copy.errors.generic;
  }
}

function resolveErrorMessage(
  copy: AccountSecurityCopy,
  code: AnyErrorCode,
): string {
  switch (code) {
    case "current_password_required":
      return copy.errors.currentPasswordRequired;
    case "new_password_required":
      return copy.errors.newPasswordRequired;
    case "invalid_current_password":
      return copy.errors.invalidCurrentPassword;
    case "new_password_must_differ":
      return copy.errors.newPasswordMustDiffer;
    case "weak_new_password":
      return copy.errors.weakNewPassword;
    case "invalid_recovery_credentials":
      return copy.errors.invalidRecoveryCredentials;
    case "invalid_reset_token":
      return copy.errors.invalidResetToken;
    case "not_connected":
      return copy.errors.notConnected;
    case "rate_limited":
      return copy.errors.rateLimited;
    case "network_failed":
      return copy.errors.networkFailed;
    case "login_required":
      return copy.errors.loginRequired;
    case "recovery_code_required":
      return copy.errors.recoveryCodeRequired;
    case "reset_token_required":
      return copy.errors.resetTokenRequired;
    case "unauthorized":
      return copy.errors.unauthorized;
    default:
      return copy.errors.generic;
  }
}

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    stack: {
      gap: spacing.lg,
    },
    helperText: {
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 20,
    },
    subheading: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "600",
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
    modalBackdrop: {
      alignItems: "center",
      backgroundColor: "rgba(23, 16, 12, 0.58)",
      flex: 1,
      justifyContent: "center",
      padding: spacing.lg,
    },
    modalCard: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      gap: spacing.md,
      maxWidth: 420,
      padding: spacing.lg,
      width: "100%",
    },
    modalTitle: {
      color: colors.text,
      fontSize: 18,
      fontWeight: "600",
    },
    codeCard: {
      backgroundColor: colors.surfaceMuted,
      borderRadius: 8,
      padding: spacing.md,
    },
    codeText: {
      color: colors.text,
      fontFamily: "monospace",
      fontSize: 16,
      letterSpacing: 1,
    },
    uriText: {
      color: colors.text,
      fontFamily: "monospace",
      fontSize: 12,
    },
    totpTabs: {
      flexDirection: "row",
      gap: spacing.sm,
    },
  });
}
