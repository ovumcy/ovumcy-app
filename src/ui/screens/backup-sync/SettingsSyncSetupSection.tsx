import { type PropsWithChildren, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  type StyleProp,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";

import type { SettingsViewData } from "../../../services/settings-view-service";
import type {
  BackupSyncErrorPresentation,
  BackupSyncSetupPresentation,
} from "../../../services/backup-sync-view-service";
import type { ResolvedBillingOffer } from "../../../services/offers-service";
import type {
  SyncPreferencesRecord,
} from "../../../sync/sync-contract";
import { AppButton } from "../../components/AppButton";
import { AppTextInput } from "../../components/AppTextInput";
import { ChoiceGroup } from "../../components/ChoiceGroup";
import { FeatureCard } from "../../components/FeatureCard";
import { OfferCard } from "../../components/OfferCard";
import { StatusBanner } from "../../components/StatusBanner";
import type { AppThemeColors } from "../../theme/tokens";
import { fontScale, spacing } from "../../theme/tokens";
import { useThemedStyles } from "../../theme/useThemedStyles";

type SettingsSyncSetupSectionProps = {
  authLoginValue: string;
  authPasswordValue: string;
  billingOffers?: ResolvedBillingOffer[];
  confirmActionLabel: string;
  errorPresentation: BackupSyncErrorPresentation;
  generatedRecoveryCode: string;
  generatedRecoveryPhrase: string;
  hasSyncSession: boolean;
  hasStoredSyncSecrets: boolean;
  isExportingRecoveryPhrase: boolean;
  isPreparing: boolean;
  onAcknowledgeRecoveryCode: () => void;
  onAuthLoginChange: (value: string) => void;
  onAuthPasswordChange: (value: string) => void;
  onCancelRenewal?: (() => void | Promise<void>) | undefined;
  onDisconnect: () => void | Promise<void>;
  onDeleteAccount: () => void | Promise<void>;
  onDeviceLabelChange: (value: string) => void;
  onDismissOffer?: ((offerID: string) => void | Promise<void>) | undefined;
  onEndpointChange: (value: string) => void;
  onExportRecoveryPhrase: () => void | Promise<void>;
  onLogin: () => void | Promise<void>;
  onModeSelect: (value: SyncPreferencesRecord["mode"]) => void;
  onOfferCTAPress?: ((offer: ResolvedBillingOffer) => void) | undefined;
  onPrepare: () => void | Promise<void>;
  onRecoverAccess: () => void | Promise<void>;
  onResumeRenewal?: (() => void | Promise<void>) | undefined;
  onRetryPlanCheck: () => void | Promise<void>;
  onRecoveryPhraseChange: (value: string) => void;
  onRegister: () => void | Promise<void>;
  onRestore: () => void | Promise<void>;
  onSyncNow: () => void | Promise<void>;
  presentation: BackupSyncSetupPresentation;
  preferences: SyncPreferencesRecord;
  recoveryPhraseValue: string;
  showCardHeader?: boolean;
  statusMessage: string;
  viewData: SettingsViewData["account"];
};

export function SettingsSyncSetupSection({
  authLoginValue,
  authPasswordValue,
  billingOffers = [],
  confirmActionLabel,
  errorPresentation,
  generatedRecoveryCode,
  generatedRecoveryPhrase,
  hasSyncSession,
  hasStoredSyncSecrets,
  isExportingRecoveryPhrase,
  isPreparing,
  onAcknowledgeRecoveryCode,
  onAuthLoginChange,
  onAuthPasswordChange,
  onCancelRenewal,
  onDisconnect,
  onDeleteAccount,
  onDeviceLabelChange,
  onDismissOffer,
  onEndpointChange,
  onExportRecoveryPhrase,
  onLogin,
  onModeSelect,
  onOfferCTAPress,
  onPrepare,
  onRecoverAccess,
  onResumeRenewal,
  onRetryPlanCheck,
  onRecoveryPhraseChange,
  onRegister,
  onRestore,
  onSyncNow,
  presentation,
  preferences,
  recoveryPhraseValue,
  showCardHeader = true,
  statusMessage,
  viewData,
}: SettingsSyncSetupSectionProps) {
  const styles = useThemedStyles(createStyles);
  const [activeAccountPane, setActiveAccountPane] = useState<"auth" | "restore">(
    "auth",
  );
  const [isRecoveryPhraseModalVisible, setIsRecoveryPhraseModalVisible] =
    useState(false);
  const [isRecoveryCodeModalVisible, setIsRecoveryCodeModalVisible] =
    useState(false);

  useEffect(() => {
    setIsRecoveryPhraseModalVisible(generatedRecoveryPhrase.length > 0);
  }, [generatedRecoveryPhrase]);

  useEffect(() => {
    setIsRecoveryCodeModalVisible(generatedRecoveryCode.length > 0);
  }, [generatedRecoveryCode]);

  useEffect(() => {
    if (hasStoredSyncSecrets && activeAccountPane === "restore") {
      setActiveAccountPane("auth");
    }
  }, [activeAccountPane, hasStoredSyncSecrets]);

  function handleAccountSubmit() {
    if (hasSyncSession) {
      return;
    }

    if (activeAccountPane === "restore" && !hasStoredSyncSecrets) {
      if (presentation.accountActionsDisabled) {
        return;
      }
      void onRecoverAccess();
      return;
    }

    if (presentation.accountActionButtonsDisabled) {
      return;
    }

    void onLogin();
  }

  const renderStepTitle = (title: string, done: boolean) => (
    <View style={styles.stepTitleRow}>
      <Text style={styles.stepTitle}>{title}</Text>
      {done ? (
        <Text
          maxFontSizeMultiplier={fontScale.compact}
          numberOfLines={1}
          style={styles.stepDoneBadge}
          testID="settings-sync-step-done"
        >
          ✓
        </Text>
      ) : null}
    </View>
  );

  return (
    <FeatureCard
      description={showCardHeader ? viewData.subtitle : undefined}
      testID="settings-sync-section"
      title={showCardHeader ? viewData.title : undefined}
    >
      <View style={styles.stack}>
        <StatusBanner
          message={presentation.guidanceMessage}
          testID="settings-sync-guidance-banner"
          tone={presentation.guidanceComplete ? "success" : "info"}
        />

        <View style={styles.formGroup}>
          <Text style={styles.fieldLabel}>{viewData.modeLabel}</Text>
          <ChoiceGroup
            groupLabel={viewData.modeLabel}
            layout="grid2"
            onSelect={(value) => {
              if (presentation.accountActionsDisabled) {
                return;
              }

              onModeSelect(value);
            }}
            options={viewData.modeOptions}
            selectedValue={preferences.mode}
            testIDPrefix="settings-sync-mode"
          />
          <Text style={styles.helperText}>
            {presentation.isManaged
              ? viewData.managedHint
              : viewData.selfHostedHint}
          </Text>
        </View>

        {preferences.mode === "self_hosted" ? (
          <View style={styles.formGroup}>
            <Text style={styles.fieldLabel}>{viewData.endpointLabel}</Text>
            <AppTextInput
              accessibilityLabel={viewData.endpointLabel}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!presentation.accountActionsDisabled}
              keyboardType={Platform.OS === "web" ? "default" : "url"}
              onChangeText={onEndpointChange}
              placeholder={viewData.endpointPlaceholder}
              style={styles.input}
              testID="settings-sync-endpoint-input"
              value={preferences.endpointInput}
            />
            {errorPresentation.endpointMessage ? (
              <Text style={styles.inlineErrorText}>
                {errorPresentation.endpointMessage}
              </Text>
            ) : null}
            <Text style={styles.helperText}>{viewData.endpointHint}</Text>
          </View>
        ) : null}

        <View style={styles.formGroup}>
          <Text style={styles.fieldLabel}>{viewData.deviceLabel}</Text>
          <AppTextInput
            accessibilityLabel={viewData.deviceLabel}
            autoCapitalize="words"
            autoCorrect={false}
            editable={!presentation.accountActionsDisabled}
            onChangeText={onDeviceLabelChange}
            placeholder={viewData.devicePlaceholder}
            style={styles.input}
            testID="settings-sync-device-label-input"
            value={preferences.deviceLabel}
          />
          {errorPresentation.deviceLabelMessage ? (
            <Text style={styles.inlineErrorText}>
              {errorPresentation.deviceLabelMessage}
            </Text>
          ) : null}
          <Text style={styles.helperText}>{viewData.deviceHint}</Text>
        </View>

        {statusMessage ? (
          <StatusBanner
            message={statusMessage}
            testID="settings-sync-status-banner"
            tone="success"
          />
        ) : null}

        <View style={styles.stepCard} testID="settings-sync-local-step">
          <View style={styles.stepHeader}>
            {renderStepTitle(presentation.localStepTitle, hasStoredSyncSecrets)}
            <Text style={styles.helperText}>{viewData.localStepHint}</Text>
          </View>

          {errorPresentation.localMessage ? (
            <StatusBanner
              message={errorPresentation.localMessage}
              testID="settings-sync-local-error-banner"
              tone="error"
            />
          ) : null}

          {isPreparing ? (
            <View style={styles.progressCard} testID="settings-sync-preparing-block">
              <ActivityIndicator size="small" style={styles.progressSpinner} />
              <View style={styles.progressCopy}>
                <Text style={styles.progressTitle}>{viewData.preparingTitle}</Text>
                <Text style={styles.progressHint}>{viewData.preparingHint}</Text>
              </View>
            </View>
          ) : null}

          <View style={styles.recoveryCard}>
            <Text style={styles.recoveryTitle}>{viewData.recoveryTitle}</Text>
            <Text style={styles.helperText}>{viewData.recoveryHint}</Text>
            {generatedRecoveryPhrase ? (
              <View style={styles.recoveryPhraseCard} testID="settings-sync-recovery-card">
                <Text
                  style={styles.recoveryPhrase}
                  testID="settings-sync-recovery-phrase"
                >
                  {generatedRecoveryPhrase}
                </Text>
                <Text style={styles.recoveryNotice}>{viewData.recoveryShownOnce}</Text>
                <AppButton
                  disabled={isExportingRecoveryPhrase}
                  label={viewData.recoveryExportLabel}
                  onPress={onExportRecoveryPhrase}
                  testID="settings-sync-recovery-export-button"
                  variant="secondary"
                />
              </View>
            ) : (
              <Text style={styles.recoveryNotice}>{viewData.recoveryNotice}</Text>
            )}
          </View>

          {presentation.shouldShowPrepareAction ? (
            <AppButton
              disabled={presentation.accountActionsDisabled}
              label={presentation.actionLabel}
              onPress={onPrepare}
              testID="settings-sync-prepare-button"
              variant="secondary"
            />
          ) : null}
        </View>

        <View style={styles.stepCard} testID="settings-sync-account-step">
          <View style={styles.stepHeader}>
            {renderStepTitle(presentation.accountStepTitle, hasSyncSession)}
            <Text style={styles.helperText}>
              {presentation.isManaged
                ? viewData.accountStepHintManaged
                : viewData.accountStepHintSelfHosted}
            </Text>
          </View>

          {errorPresentation.accountMessage ? (
            <StatusBanner
              message={errorPresentation.accountMessage}
              testID="settings-sync-account-error-banner"
              tone="error"
            />
          ) : null}

          {presentation.supportsInlineAccountAuth ? (
            <>
              {!hasStoredSyncSecrets ? (
                <View style={styles.formGroup}>
                  <Text style={styles.fieldLabel}>{viewData.connectionLabel}</Text>
                  <ChoiceGroup
                    groupLabel={viewData.connectionLabel}
                    layout="grid2"
                    onSelect={(value) => {
                      setActiveAccountPane(value);
                    }}
                    options={[
                      {
                        value: "auth",
                        label: `${viewData.loginActionLabel} / ${viewData.registerLabel}`,
                      },
                      {
                        value: "restore",
                        label: viewData.recoverAccessLabel,
                      },
                    ]}
                    selectedValue={activeAccountPane}
                    testIDPrefix="settings-sync-account-pane"
                  />
                </View>
              ) : null}

              <SettingsSyncAccountForm
                onSubmit={handleAccountSubmit}
                style={styles.accountForm}
                testID="settings-sync-account-form"
              >
                <View style={styles.formGroup}>
                  <Text style={styles.fieldLabel}>{viewData.loginLabel}</Text>
                  <AppTextInput
                    accessibilityLabel={viewData.loginLabel}
                    autoCapitalize="none"
                    autoComplete="username"
                    autoCorrect={false}
                    editable={!presentation.accountActionsDisabled}
                    onChangeText={onAuthLoginChange}
                    placeholder={viewData.loginPlaceholder}
                    style={styles.input}
                    testID="settings-sync-login-input"
                    textContentType="username"
                    value={authLoginValue}
                  />
                  {errorPresentation.loginMessage ? (
                    <Text style={styles.inlineErrorText}>
                      {errorPresentation.loginMessage}
                    </Text>
                  ) : null}
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.fieldLabel}>{viewData.passwordLabel}</Text>
                  <AppTextInput
                    accessibilityLabel={viewData.passwordLabel}
                    autoCapitalize="none"
                    autoComplete="current-password"
                    autoCorrect={false}
                    editable={!presentation.accountActionsDisabled}
                    onChangeText={onAuthPasswordChange}
                    onSubmitEditing={handleAccountSubmit}
                    placeholder={viewData.passwordPlaceholder}
                    returnKeyType="go"
                    secureTextEntry
                    style={styles.input}
                    testID="settings-sync-password-input"
                    textContentType="password"
                    value={authPasswordValue}
                  />
                  {errorPresentation.passwordMessage ? (
                    <Text style={styles.inlineErrorText}>
                      {errorPresentation.passwordMessage}
                    </Text>
                  ) : null}
                </View>

                {!hasStoredSyncSecrets && activeAccountPane === "restore" ? (
                  <View
                    style={styles.recoveryImportCard}
                    testID="settings-sync-recovery-import-block"
                  >
                    <Text style={styles.stepTitle}>{viewData.recoveryImportTitle}</Text>
                    <Text style={styles.helperText}>{viewData.recoveryImportHint}</Text>
                    <View style={styles.formGroup}>
                      <Text style={styles.fieldLabel}>
                        {viewData.recoveryPhraseInputLabel}
                      </Text>
                      <AppTextInput
                        accessibilityLabel={viewData.recoveryPhraseInputLabel}
                        autoCapitalize="none"
                        autoCorrect={false}
                        editable={!presentation.accountActionsDisabled}
                        multiline
                        onChangeText={onRecoveryPhraseChange}
                        placeholder={viewData.recoveryPhraseInputPlaceholder}
                        style={[styles.input, styles.recoveryInput]}
                        testID="settings-sync-recovery-input"
                        value={recoveryPhraseValue}
                      />
                      {errorPresentation.recoveryPhraseMessage ? (
                        <Text style={styles.inlineErrorText}>
                          {errorPresentation.recoveryPhraseMessage}
                        </Text>
                      ) : null}
                      <Text style={styles.helperText}>
                        {viewData.recoveryPhraseInputHint}
                      </Text>
                    </View>
                    <AppButton
                      disabled={presentation.accountActionsDisabled}
                      label={viewData.recoverAccessLabel}
                      onPress={onRecoverAccess}
                      testID="settings-sync-recover-button"
                      variant="secondary"
                    />
                  </View>
                ) : null}

                {!hasSyncSession && activeAccountPane === "auth" ? (
                  <View style={styles.actionsStack}>
                    <AppButton
                      disabled={presentation.accountActionButtonsDisabled}
                      label={viewData.registerLabel}
                      onPress={onRegister}
                      testID="settings-sync-register-button"
                      variant="secondary"
                    />
                    <AppButton
                      disabled={presentation.accountActionButtonsDisabled}
                      label={viewData.loginActionLabel}
                      onPress={onLogin}
                      testID="settings-sync-login-button"
                    />
                  </View>
                ) : null}
                {!hasStoredSyncSecrets && !hasSyncSession && activeAccountPane === "auth" ? (
                  <Text style={styles.helperText}>{viewData.errors.syncNotPrepared}</Text>
                ) : null}
              </SettingsSyncAccountForm>
            </>
          ) : (
            <StatusBanner
              message={viewData.planUnavailable}
              testID="settings-sync-managed-account-banner"
              tone="info"
            />
          )}
        </View>

        {presentation.isManaged ? (
          <View style={styles.stepCard} testID="settings-sync-plan-step">
            <View style={styles.stepHeader}>
              {renderStepTitle(presentation.planStepTitle, presentation.hasManagedPlan)}
              <Text style={styles.helperText}>{viewData.planStepHint}</Text>
            </View>
            <StatusBanner
              message={presentation.planMessage}
              testID="settings-sync-plan-banner"
              tone={presentation.hasManagedPlan ? "success" : "info"}
            />
            {presentation.planCountdownMessage ? (
              <Text
                style={styles.helperText}
                testID="settings-sync-plan-countdown"
              >
                {presentation.planCountdownMessage}
              </Text>
            ) : null}
            {presentation.showRenewalManagement ? (
              <View
                style={styles.actionsStack}
                testID="settings-sync-renewal-row"
              >
                {presentation.showCancelRenewal ? (
                  <AppButton
                    disabled={presentation.accountActionsDisabled}
                    label={viewData.renewalCancelLabel}
                    onPress={onCancelRenewal ?? (() => {})}
                    testID="settings-sync-renewal-cancel-button"
                    variant="secondary"
                  />
                ) : null}
                {presentation.showResumeRenewal ? (
                  <AppButton
                    disabled={presentation.accountActionsDisabled}
                    label={viewData.renewalResumeLabel}
                    onPress={onResumeRenewal ?? (() => {})}
                    testID="settings-sync-renewal-resume-button"
                    variant="secondary"
                  />
                ) : null}
              </View>
            ) : null}
            <View
              style={styles.stepHeader}
              testID="settings-sync-withdrawal-notice"
            >
              <Text style={styles.fieldLabel}>{viewData.withdrawalTitle}</Text>
              <Text style={styles.helperText}>{viewData.withdrawalBody}</Text>
            </View>
            {billingOffers.map((offer) => (
              <OfferCard
                body={offer.body}
                title={offer.title}
                // play_checkout CTAs stay inert until Play Billing lands in a
                // later phase; only "screen" offers are actionable in v1.
                ctaDisabled={offer.action.type === "play_checkout"}
                ctaLabel={offer.cta}
                dismissAccessibilityLabel={viewData.offerDismissLabel}
                eyebrowLabel={
                  offer.kind === "subscription_promo"
                    ? viewData.offerPromoEyebrow
                    : viewData.offerAnnouncementEyebrow
                }
                key={offer.id}
                onDismiss={() => {
                  void onDismissOffer?.(offer.id);
                }}
                onPressCTA={
                  offer.action.type === "screen" && onOfferCTAPress
                    ? () => {
                        onOfferCTAPress(offer);
                      }
                    : undefined
                }
                testID={`settings-sync-offer-${offer.id}`}
              />
            ))}
            <Text style={styles.helperText}>{viewData.planUnavailable}</Text>
            {hasSyncSession && !presentation.hasManagedPlan ? (
              <AppButton
                disabled={presentation.accountActionsDisabled}
                label={viewData.checkPlanAgain}
                onPress={onRetryPlanCheck}
                testID="settings-sync-plan-retry-button"
                variant="secondary"
              />
            ) : null}
          </View>
        ) : null}

        <View style={styles.stepCard} testID="settings-sync-actions-step">
          <View style={styles.stepHeader}>
            {renderStepTitle(presentation.syncStepTitle, presentation.canShowSyncActions)}
            <Text style={styles.helperText}>
              {presentation.isManaged
                ? viewData.syncStepHintManaged
                : viewData.syncStepHintSelfHosted}
            </Text>
          </View>

          {errorPresentation.syncMessage ? (
            <StatusBanner
              message={errorPresentation.syncMessage}
              testID="settings-sync-actions-error-banner"
              tone="error"
            />
          ) : null}

          {errorPresentation.deleteAccountMessage ? (
            <StatusBanner
              message={errorPresentation.deleteAccountMessage}
              testID="settings-sync-delete-account-error-banner"
              tone="error"
            />
          ) : null}

          {presentation.isManaged && hasSyncSession && !presentation.hasManagedPlan ? (
            <StatusBanner
              message={viewData.syncBlockedNoPlan}
              testID="settings-sync-plan-blocked-banner"
            />
          ) : null}

          {presentation.canShowSyncActions ? (
            <View style={styles.actionsStack}>
              <AppButton
                disabled={presentation.accountActionsDisabled}
                label={viewData.syncNowLabel}
                onPress={onSyncNow}
                testID="settings-sync-upload-button"
              />
              <AppButton
                disabled={presentation.accountActionsDisabled}
                label={viewData.restoreLabel}
                onPress={onRestore}
                testID="settings-sync-restore-button"
                variant="secondary"
              />
              <AppButton
                disabled={presentation.accountActionsDisabled}
                label={viewData.disconnectLabel}
                onPress={onDisconnect}
                testID="settings-sync-disconnect-button"
                variant="secondary"
              />
              <AppButton
                disabled={presentation.accountActionsDisabled}
                label={viewData.deleteAccountLabel}
                onPress={onDeleteAccount}
                testID="settings-sync-delete-account-button"
                variant="danger"
              />
            </View>
          ) : presentation.shouldShowDisconnectOnly ? (
            <View style={styles.actionsStack}>
              <AppButton
                disabled={presentation.accountActionsDisabled}
                label={viewData.disconnectLabel}
                onPress={onDisconnect}
                testID="settings-sync-disconnect-button"
                variant="secondary"
              />
              <AppButton
                disabled={presentation.accountActionsDisabled}
                label={viewData.deleteAccountLabel}
                onPress={onDeleteAccount}
                testID="settings-sync-delete-account-button"
                variant="danger"
              />
            </View>
          ) : null}
        </View>

        <View style={styles.recapRow} testID="settings-sync-status-recap">
          <Text style={styles.summaryLabel}>{viewData.lastSyncLabel}</Text>
          <Text style={styles.summaryValue}>{presentation.lastSyncValue}</Text>
        </View>

        <Modal
          animationType="fade"
          onRequestClose={() => {
            setIsRecoveryPhraseModalVisible(false);
          }}
          transparent
          visible={isRecoveryPhraseModalVisible}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard} testID="settings-sync-recovery-modal">
              <Text style={styles.modalTitle}>{viewData.recoveryTitle}</Text>
              <Text style={styles.helperText}>{viewData.recoveryHint}</Text>
              {errorPresentation.localMessage ? (
                <StatusBanner
                  message={errorPresentation.localMessage}
                  testID="settings-sync-recovery-modal-error-banner"
                  tone="error"
                />
              ) : null}
              <View style={styles.modalPhraseCard}>
                <Text style={styles.modalPhrase}>
                  {generatedRecoveryPhrase}
                </Text>
              </View>
              <View style={styles.actionsStack}>
                <AppButton
                  disabled={isExportingRecoveryPhrase}
                  label={viewData.recoveryExportLabel}
                  onPress={onExportRecoveryPhrase}
                  testID="settings-sync-recovery-modal-export-button"
                  variant="secondary"
                />
                <AppButton
                  label={confirmActionLabel}
                  onPress={() => {
                    setIsRecoveryPhraseModalVisible(false);
                  }}
                  testID="settings-sync-recovery-modal-confirm-button"
                />
              </View>
            </View>
          </View>
        </Modal>

        <Modal
          animationType="fade"
          onRequestClose={onAcknowledgeRecoveryCode}
          transparent
          visible={isRecoveryCodeModalVisible}
        >
          <View style={styles.modalBackdrop}>
            <View
              style={styles.modalCard}
              testID="settings-sync-recovery-code-modal"
            >
              <Text style={styles.modalTitle}>
                {viewData.recoveryCodeTitle}
              </Text>
              <Text style={styles.helperText}>
                {viewData.recoveryCodeHint}
              </Text>
              <View style={styles.modalPhraseCard}>
                <Text
                  selectable
                  style={styles.modalPhrase}
                  testID="settings-sync-recovery-code-value"
                >
                  {generatedRecoveryCode}
                </Text>
              </View>
              <View style={styles.actionsStack}>
                <AppButton
                  label={confirmActionLabel}
                  onPress={onAcknowledgeRecoveryCode}
                  testID="settings-sync-recovery-code-confirm-button"
                />
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </FeatureCard>
  );
}

function SettingsSyncAccountForm({
  children,
  onSubmit,
  style,
  testID,
}: PropsWithChildren<{
  onSubmit: () => void | Promise<void>;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}>) {
  if (Platform.OS !== "web") {
    return (
      <View style={style} testID={testID}>
        {children}
      </View>
    );
  }

  return (
    <form
      data-testid={testID}
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit();
      }}
      style={{ margin: 0 }}
    >
      <View style={style}>{children}</View>
    </form>
  );
}

const createStyles = (colors: AppThemeColors) =>
  StyleSheet.create({
    stack: {
      gap: spacing.md,
    },
    formGroup: {
      gap: spacing.sm,
    },
    accountForm: {
      gap: spacing.md,
    },
    fieldLabel: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "700",
    },
    helperText: {
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 21,
    },
    inlineErrorText: {
      color: colors.statusErrorText,
      fontSize: 13,
      lineHeight: 18,
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
    recoveryInput: {
      minHeight: 92,
      textAlignVertical: "top",
    },
    summaryGrid: {
      gap: spacing.sm,
    },
    summaryCard: {
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.border,
      borderRadius: 16,
      borderWidth: 1,
      gap: spacing.xs,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    summaryLabel: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "700",
    },
    summaryValue: {
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 18,
    },
    recapRow: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
      paddingHorizontal: spacing.xs,
    },
    stepCard: {
      backgroundColor: colors.surface,
      borderColor: colors.lineSoft,
      borderRadius: 18,
      borderWidth: 1,
      gap: spacing.md,
      padding: spacing.md,
    },
    stepHeader: {
      gap: spacing.xs,
    },
    stepTitleRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.sm,
    },
    stepTitle: {
      color: colors.text,
      flexShrink: 1,
      fontSize: 16,
      fontWeight: "700",
    },
    stepDoneBadge: {
      backgroundColor: colors.statusSuccessBadgeBg,
      borderRadius: 999,
      color: colors.statusSuccessText,
      fontSize: 13,
      fontWeight: "700",
      overflow: "hidden",
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    progressCard: {
      alignItems: "flex-start",
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.lineSoft,
      borderRadius: 16,
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing.sm,
      padding: spacing.md,
    },
    progressSpinner: {
      marginTop: 2,
    },
    progressCopy: {
      flex: 1,
      gap: spacing.xs,
    },
    progressTitle: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "700",
    },
    progressHint: {
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 18,
    },
    recoveryCard: {
      gap: spacing.sm,
    },
    recoveryImportCard: {
      gap: spacing.sm,
    },
    recoveryTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "700",
    },
    recoveryPhraseCard: {
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.lineSoft,
      borderRadius: 16,
      borderWidth: 1,
      gap: spacing.xs,
      padding: spacing.md,
    },
    recoveryPhrase: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "600",
      letterSpacing: 0.3,
      lineHeight: 24,
    },
    recoveryNotice: {
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 18,
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
    modalPhraseCard: {
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.lineSoft,
      borderRadius: 16,
      borderWidth: 1,
      padding: spacing.md,
    },
    modalPhrase: {
      color: colors.text,
      fontSize: 17,
      fontWeight: "700",
      letterSpacing: 0.5,
      lineHeight: 28,
    },
    actionsStack: {
      gap: spacing.sm,
    },
  });
