import { Modal, StyleSheet, Text, View } from "react-native";

import type { PartnerCopy } from "../../../i18n/partner-copy";
import { AppButton } from "../../components/AppButton";
import { AppTextInput } from "../../components/AppTextInput";
import { FeatureCard } from "../../components/FeatureCard";
import { StatusBanner } from "../../components/StatusBanner";
import type { AppThemeColors } from "../../theme/tokens";
import { spacing } from "../../theme/tokens";
import { useThemedStyles } from "../../theme/useThemedStyles";

type GuestUpgradeSectionProps = {
  copy: PartnerCopy;
  emailValue: string;
  formErrorMessage: string;
  generatedRecoveryCode: string;
  isFormOpen: boolean;
  isGuestPartner: boolean;
  isSubmitting: boolean;
  nudgeMessage: string;
  onAcknowledgeRecoveryCode: () => void;
  onCancelForm: () => void;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmitForm: () => void | Promise<void>;
  onTapKeepAccess: () => void | Promise<void>;
  passwordValue: string;
};

/**
 * Guest-account-upgrade affordance (ovumcy-app#118). Deliberately rendered
 * as its own top-level section in `BackupSyncFlowScreen` — NOT nested inside
 * `SettingsPartnerAccessSection`'s "Advanced" toggle gating — so a guest
 * lands on it immediately every time they open Backup & sync, the same way
 * the accept-invite card escapes that toggle. The CTA/nudge card is gated on
 * `isGuestPartner` alone; the one-time recovery-code modal is intentionally
 * NOT gated on it, because a successful upgrade clears the guest marker
 * (flipping `isGuestPartner` to false) in the same state update that
 * populates `generatedRecoveryCode` — gating the modal too would make the
 * reveal disappear before the owner ever saw it.
 */
export function GuestUpgradeSection({
  copy,
  emailValue,
  formErrorMessage,
  generatedRecoveryCode,
  isFormOpen,
  isGuestPartner,
  isSubmitting,
  nudgeMessage,
  onAcknowledgeRecoveryCode,
  onCancelForm,
  onEmailChange,
  onPasswordChange,
  onSubmitForm,
  onTapKeepAccess,
  passwordValue,
}: GuestUpgradeSectionProps) {
  const styles = useThemedStyles(createStyles);
  const upgradeCopy = copy.guestUpgrade;

  return (
    <>
      {isGuestPartner ? (
        <FeatureCard testID="backup-sync-guest-upgrade-section" title={upgradeCopy.formTitle}>
          <View style={styles.stack}>
            {nudgeMessage ? (
              <StatusBanner
                message={nudgeMessage}
                testID="backup-sync-guest-upgrade-nudge"
                tone="info"
              />
            ) : null}
            <Text style={styles.hint}>{upgradeCopy.ctaHint}</Text>
            {!isFormOpen && formErrorMessage ? (
              <StatusBanner
                message={formErrorMessage}
                testID="backup-sync-guest-upgrade-error-banner"
                tone="error"
              />
            ) : null}
            <AppButton
              label={upgradeCopy.ctaLabel}
              onPress={onTapKeepAccess}
              testID="backup-sync-guest-upgrade-cta"
            />
          </View>
        </FeatureCard>
      ) : null}

      <Modal animationType="fade" onRequestClose={onCancelForm} transparent visible={isFormOpen}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard} testID="backup-sync-guest-upgrade-form-modal">
            <Text style={styles.modalTitle}>{upgradeCopy.formTitle}</Text>
            <Text style={styles.hint}>{upgradeCopy.formHint}</Text>

            {isFormOpen && formErrorMessage ? (
              <StatusBanner
                message={formErrorMessage}
                testID="backup-sync-guest-upgrade-form-error-banner"
                tone="error"
              />
            ) : null}

            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>{upgradeCopy.emailLabel}</Text>
              <AppTextInput
                accessibilityLabel={upgradeCopy.emailLabel}
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect={false}
                editable={!isSubmitting}
                keyboardType="email-address"
                onChangeText={onEmailChange}
                placeholder={upgradeCopy.emailPlaceholder}
                style={styles.input}
                testID="backup-sync-guest-upgrade-email-input"
                textContentType="emailAddress"
                value={emailValue}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>{upgradeCopy.passwordLabel}</Text>
              <AppTextInput
                accessibilityLabel={upgradeCopy.passwordLabel}
                autoCapitalize="none"
                autoComplete="new-password"
                autoCorrect={false}
                editable={!isSubmitting}
                onChangeText={onPasswordChange}
                onSubmitEditing={onSubmitForm}
                placeholder={upgradeCopy.passwordPlaceholder}
                returnKeyType="go"
                secureTextEntry
                style={styles.input}
                testID="backup-sync-guest-upgrade-password-input"
                textContentType="newPassword"
                value={passwordValue}
              />
            </View>

            <View style={styles.actionsStack}>
              <AppButton
                disabled={isSubmitting}
                label={upgradeCopy.submitLabel}
                onPress={onSubmitForm}
                testID="backup-sync-guest-upgrade-submit-button"
              />
              <AppButton
                disabled={isSubmitting}
                label={upgradeCopy.cancelLabel}
                onPress={onCancelForm}
                testID="backup-sync-guest-upgrade-cancel-button"
                variant="secondary"
              />
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        onRequestClose={onAcknowledgeRecoveryCode}
        transparent
        visible={generatedRecoveryCode.length > 0}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard} testID="backup-sync-guest-upgrade-recovery-code-modal">
            <Text style={styles.modalTitle}>{upgradeCopy.revealTitle}</Text>
            <Text style={styles.hint}>{upgradeCopy.revealHint}</Text>
            <View style={styles.recoveryCodeCard}>
              <Text
                selectable
                style={styles.recoveryCodeValue}
                testID="backup-sync-guest-upgrade-recovery-code-value"
              >
                {generatedRecoveryCode}
              </Text>
            </View>
            <AppButton
              label={upgradeCopy.revealConfirmLabel}
              onPress={onAcknowledgeRecoveryCode}
              testID="backup-sync-guest-upgrade-recovery-code-confirm-button"
            />
          </View>
        </View>
      </Modal>
    </>
  );
}

const createStyles = (colors: AppThemeColors) =>
  StyleSheet.create({
    stack: {
      gap: spacing.md,
    },
    hint: {
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 21,
    },
    formGroup: {
      gap: spacing.sm,
    },
    fieldLabel: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "700",
    },
    input: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 16,
      borderWidth: 1,
      color: colors.text,
      fontSize: 15,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    actionsStack: {
      gap: spacing.sm,
    },
    modalBackdrop: {
      alignItems: "center",
      backgroundColor: "rgba(23, 16, 12, 0.58)",
      flex: 1,
      justifyContent: "center",
      padding: spacing.md,
    },
    modalCard: {
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.lineSoft,
      borderRadius: 20,
      borderWidth: 1,
      gap: spacing.md,
      maxWidth: 520,
      padding: spacing.md,
      width: "100%",
    },
    modalTitle: {
      color: colors.text,
      fontSize: 18,
      fontWeight: "800",
    },
    recoveryCodeCard: {
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.lineSoft,
      borderRadius: 16,
      borderWidth: 1,
      padding: spacing.md,
    },
    recoveryCodeValue: {
      color: colors.text,
      fontSize: 17,
      fontWeight: "700",
      letterSpacing: 0.5,
      lineHeight: 28,
    },
  });
