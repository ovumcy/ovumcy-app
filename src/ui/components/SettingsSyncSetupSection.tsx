import { ActivityIndicator, StyleSheet, Text, TextInput, View } from "react-native";

import type { SettingsViewData } from "../../services/settings-view-service";
import type {
  SyncCapabilityDocument,
  SyncPreferencesRecord,
} from "../../sync/sync-contract";
import type { AppThemeColors } from "../theme/tokens";
import { spacing } from "../theme/tokens";
import { useThemedStyles } from "../theme/useThemedStyles";
import { AppButton } from "./AppButton";
import { ChoiceGroup } from "./ChoiceGroup";
import { FeatureCard } from "./FeatureCard";
import { StatusBanner } from "./StatusBanner";

type SettingsSyncSetupSectionProps = {
  authLoginValue: string;
  authPasswordValue: string;
  errorMessage: string;
  generatedRecoveryPhrase: string;
  hasSyncSession: boolean;
  hasStoredSyncSecrets: boolean;
  isAuthenticating: boolean;
  isPreparing: boolean;
  isRestoring: boolean;
  isSyncing: boolean;
  notSetLabel: string;
  onAuthLoginChange: (value: string) => void;
  onAuthPasswordChange: (value: string) => void;
  onDisconnect: () => void | Promise<void>;
  onDeviceLabelChange: (value: string) => void;
  onEndpointChange: (value: string) => void;
  onLogin: () => void | Promise<void>;
  onModeSelect: (value: SyncPreferencesRecord["mode"]) => void;
  onPrepare: () => void | Promise<void>;
  onRegister: () => void | Promise<void>;
  onRestore: () => void | Promise<void>;
  onSyncNow: () => void | Promise<void>;
  preferences: SyncPreferencesRecord;
  statusMessage: string;
  syncCapabilities: SyncCapabilityDocument | null;
  viewData: SettingsViewData["account"];
};

export function SettingsSyncSetupSection({
  authLoginValue,
  authPasswordValue,
  errorMessage,
  generatedRecoveryPhrase,
  hasSyncSession,
  hasStoredSyncSecrets,
  isAuthenticating,
  isPreparing,
  isRestoring,
  isSyncing,
  notSetLabel,
  onAuthLoginChange,
  onAuthPasswordChange,
  onDisconnect,
  onDeviceLabelChange,
  onEndpointChange,
  onLogin,
  onModeSelect,
  onPrepare,
  onRegister,
  onRestore,
  onSyncNow,
  preferences,
  statusMessage,
  syncCapabilities,
  viewData,
}: SettingsSyncSetupSectionProps) {
  const styles = useThemedStyles(createStyles);
  const isManaged = preferences.mode === "managed";
  const hasManagedPlan = isManaged && syncCapabilities?.premiumActive === true;
  const accountActionsDisabled =
    isPreparing || isAuthenticating || isRestoring || isSyncing;
  const canShowSyncActions =
    hasStoredSyncSecrets && hasSyncSession && (!isManaged || hasManagedPlan);
  const selectedModeLabel =
    viewData.modeOptions.find((option) => option.value === preferences.mode)?.label ??
    preferences.mode;
  const endpointSummary =
    preferences.mode === "managed"
      ? selectedModeLabel
      : preferences.endpointInput.trim() || notSetLabel;
  const actionLabel = hasStoredSyncSecrets
    ? viewData.regenerateLabel
    : viewData.prepareLabel;

  let planMessage = viewData.planUnknown;
  if (isManaged && hasSyncSession) {
    if (!syncCapabilities) {
      planMessage = viewData.planCheckFailed;
    } else if (syncCapabilities.premiumActive) {
      planMessage = viewData.planActive;
    } else {
      planMessage = viewData.planInactive;
    }
  }

  return (
    <FeatureCard
      description={viewData.subtitle}
      testID="settings-sync-section"
      title={viewData.title}
    >
      <View style={styles.stack}>
        <View style={styles.formGroup}>
          <Text style={styles.fieldLabel}>{viewData.modeLabel}</Text>
          <ChoiceGroup
            layout="grid2"
            onSelect={(value) => {
              if (accountActionsDisabled) {
                return;
              }

              onModeSelect(value);
            }}
            options={viewData.modeOptions}
            selectedValue={preferences.mode}
            testIDPrefix="settings-sync-mode"
          />
          <Text style={styles.helperText}>
            {isManaged ? viewData.managedHint : viewData.selfHostedHint}
          </Text>
        </View>

        {preferences.mode === "self_hosted" ? (
          <View style={styles.formGroup}>
            <Text style={styles.fieldLabel}>{viewData.endpointLabel}</Text>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              editable={!accountActionsDisabled}
              keyboardType="url"
              onChangeText={onEndpointChange}
              placeholder={viewData.endpointPlaceholder}
              style={styles.input}
              testID="settings-sync-endpoint-input"
              value={preferences.endpointInput}
            />
            <Text style={styles.helperText}>{viewData.endpointHint}</Text>
          </View>
        ) : null}

        <View style={styles.formGroup}>
          <Text style={styles.fieldLabel}>{viewData.deviceLabel}</Text>
          <TextInput
            autoCapitalize="words"
            autoCorrect={false}
            editable={!accountActionsDisabled}
            onChangeText={onDeviceLabelChange}
            placeholder={viewData.devicePlaceholder}
            style={styles.input}
            testID="settings-sync-device-label-input"
            value={preferences.deviceLabel}
          />
          <Text style={styles.helperText}>{viewData.deviceHint}</Text>
        </View>

        <View style={styles.summaryGrid}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>{viewData.stateLabel}</Text>
            <Text style={styles.summaryValue}>
              {hasStoredSyncSecrets ? viewData.stateReady : viewData.stateMissing}
            </Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>{viewData.connectionLabel}</Text>
            <Text style={styles.summaryValue}>
              {hasSyncSession
                ? viewData.connectionReady
                : viewData.connectionMissing}
            </Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>{viewData.modeRowLabel}</Text>
            <Text style={styles.summaryValue}>{selectedModeLabel}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>{viewData.endpointRowLabel}</Text>
            <Text style={styles.summaryValue}>{endpointSummary}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>{viewData.encryptionRowLabel}</Text>
            <Text style={styles.summaryValue}>
              {hasStoredSyncSecrets
                ? viewData.encryptionReady
                : viewData.encryptionMissing}
            </Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>{viewData.lastSyncLabel}</Text>
            <Text style={styles.summaryValue}>
              {preferences.lastSyncedAt
                ? formatLastSync(preferences.lastSyncedAt)
                : viewData.lastSyncNever}
            </Text>
          </View>
        </View>

        {errorMessage ? (
          <StatusBanner
            message={errorMessage}
            testID="settings-sync-error-banner"
            tone="error"
          />
        ) : null}
        {statusMessage ? (
          <StatusBanner
            message={statusMessage}
            testID="settings-sync-status-banner"
            tone="success"
          />
        ) : null}

        <View style={styles.stepCard} testID="settings-sync-local-step">
          <View style={styles.stepHeader}>
            <Text style={styles.stepTitle}>{viewData.localStepTitle}</Text>
            <Text style={styles.helperText}>{viewData.localStepHint}</Text>
          </View>

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
                  selectable
                  style={styles.recoveryPhrase}
                  testID="settings-sync-recovery-phrase"
                >
                  {generatedRecoveryPhrase}
                </Text>
                <Text style={styles.recoveryNotice}>{viewData.recoveryShownOnce}</Text>
              </View>
            ) : (
              <Text style={styles.recoveryNotice}>{viewData.recoveryNotice}</Text>
            )}
          </View>

          <AppButton
            disabled={isPreparing}
            label={actionLabel}
            onPress={onPrepare}
            testID="settings-sync-prepare-button"
            variant="secondary"
          />
        </View>

        <View style={styles.stepCard} testID="settings-sync-account-step">
          <View style={styles.stepHeader}>
            <Text style={styles.stepTitle}>{viewData.accountStepTitle}</Text>
            <Text style={styles.helperText}>
              {isManaged
                ? viewData.accountStepHintManaged
                : viewData.accountStepHintSelfHosted}
            </Text>
          </View>

          {hasStoredSyncSecrets ? (
            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>{viewData.loginLabel}</Text>
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                editable={!accountActionsDisabled}
                onChangeText={onAuthLoginChange}
                placeholder={viewData.loginPlaceholder}
                style={styles.input}
                testID="settings-sync-login-input"
                value={authLoginValue}
              />
            </View>
          ) : null}

          {hasStoredSyncSecrets ? (
            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>{viewData.passwordLabel}</Text>
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                editable={!accountActionsDisabled}
                onChangeText={onAuthPasswordChange}
                placeholder={viewData.passwordPlaceholder}
                secureTextEntry
                style={styles.input}
                testID="settings-sync-password-input"
                value={authPasswordValue}
              />
            </View>
          ) : null}

          {hasStoredSyncSecrets && !hasSyncSession ? (
            <View style={styles.actionsStack}>
              <AppButton
                disabled={isAuthenticating || isPreparing}
                label={viewData.registerLabel}
                onPress={onRegister}
                testID="settings-sync-register-button"
                variant="secondary"
              />
              <AppButton
                disabled={isAuthenticating || isPreparing}
                label={viewData.loginActionLabel}
                onPress={onLogin}
                testID="settings-sync-login-button"
              />
            </View>
          ) : null}
        </View>

        {isManaged ? (
          <View style={styles.stepCard} testID="settings-sync-plan-step">
            <View style={styles.stepHeader}>
              <Text style={styles.stepTitle}>{viewData.planStepTitle}</Text>
              <Text style={styles.helperText}>{viewData.planStepHint}</Text>
            </View>
            <StatusBanner
              message={planMessage}
              testID="settings-sync-plan-banner"
              tone={hasManagedPlan ? "success" : "info"}
            />
            <Text style={styles.helperText}>{viewData.planUnavailable}</Text>
          </View>
        ) : null}

        <View style={styles.stepCard} testID="settings-sync-actions-step">
          <View style={styles.stepHeader}>
            <Text style={styles.stepTitle}>{viewData.syncStepTitle}</Text>
            <Text style={styles.helperText}>
              {isManaged
                ? viewData.syncStepHintManaged
                : viewData.syncStepHintSelfHosted}
            </Text>
          </View>

          {isManaged && hasSyncSession && !hasManagedPlan ? (
            <StatusBanner
              message={viewData.syncBlockedNoPlan}
              testID="settings-sync-plan-blocked-banner"
            />
          ) : null}

          {canShowSyncActions ? (
            <View style={styles.actionsStack}>
              <AppButton
                disabled={isSyncing}
                label={viewData.syncNowLabel}
                onPress={onSyncNow}
                testID="settings-sync-upload-button"
              />
              <AppButton
                disabled={isRestoring}
                label={viewData.restoreLabel}
                onPress={onRestore}
                testID="settings-sync-restore-button"
                variant="secondary"
              />
              <AppButton
                label={viewData.disconnectLabel}
                onPress={onDisconnect}
                testID="settings-sync-disconnect-button"
                variant="secondary"
              />
            </View>
          ) : hasStoredSyncSecrets && hasSyncSession ? (
            <AppButton
              label={viewData.disconnectLabel}
              onPress={onDisconnect}
              testID="settings-sync-disconnect-button"
              variant="secondary"
            />
          ) : null}
        </View>
      </View>
    </FeatureCard>
  );
}

function formatLastSync(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

const createStyles = (colors: AppThemeColors) =>
  StyleSheet.create({
    stack: {
      gap: spacing.md,
    },
    formGroup: {
      gap: spacing.sm,
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
    stepTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "700",
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
    actionsStack: {
      gap: spacing.sm,
    },
  });
