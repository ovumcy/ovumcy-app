import { StyleSheet, Text, TextInput, View } from "react-native";

import type { SettingsViewData } from "../../services/settings-view-service";
import type { SyncPreferencesRecord } from "../../sync/sync-contract";
import type { AppThemeColors } from "../theme/tokens";
import { spacing } from "../theme/tokens";
import { useThemedStyles } from "../theme/useThemedStyles";
import { AppButton } from "./AppButton";
import { ChoiceGroup } from "./ChoiceGroup";
import { FeatureCard } from "./FeatureCard";
import { StatusBanner } from "./StatusBanner";

type SettingsSyncSetupSectionProps = {
  errorMessage: string;
  generatedRecoveryPhrase: string;
  hasStoredSyncSecrets: boolean;
  isPreparing: boolean;
  notSetLabel: string;
  onDeviceLabelChange: (value: string) => void;
  onEndpointChange: (value: string) => void;
  onModeSelect: (value: SyncPreferencesRecord["mode"]) => void;
  onPrepare: () => void | Promise<void>;
  preferences: SyncPreferencesRecord;
  statusMessage: string;
  viewData: SettingsViewData["account"];
};

export function SettingsSyncSetupSection({
  errorMessage,
  generatedRecoveryPhrase,
  hasStoredSyncSecrets,
  isPreparing,
  notSetLabel,
  onDeviceLabelChange,
  onEndpointChange,
  onModeSelect,
  onPrepare,
  preferences,
  statusMessage,
  viewData,
}: SettingsSyncSetupSectionProps) {
  const styles = useThemedStyles(createStyles);
  const selectedModeLabel =
    viewData.modeOptions.find((option) => option.value === preferences.mode)?.label ??
    preferences.mode;
  const endpointSummary =
    preferences.mode === "managed"
      ? preferences.normalizedEndpoint || notSetLabel
      : preferences.endpointInput.trim() || notSetLabel;
  const actionLabel = hasStoredSyncSecrets
    ? viewData.regenerateLabel
    : viewData.prepareLabel;

  return (
    <FeatureCard
      description={viewData.subtitle}
      testID="settings-sync-section"
      title={`🔐 ${viewData.title}`}
    >
      <View style={styles.stack}>
        <View style={styles.formGroup}>
          <Text style={styles.fieldLabel}>{viewData.modeLabel}</Text>
          <ChoiceGroup
            layout="grid2"
            onSelect={onModeSelect}
            options={viewData.modeOptions}
            selectedValue={preferences.mode}
            testIDPrefix="settings-sync-mode"
          />
          <Text style={styles.helperText}>
            {preferences.mode === "managed"
              ? viewData.managedHint
              : viewData.selfHostedHint}
          </Text>
        </View>

        {preferences.mode === "self_hosted" ? (
          <View style={styles.formGroup}>
            <Text style={styles.fieldLabel}>{viewData.endpointLabel}</Text>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
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
            onChangeText={onDeviceLabelChange}
            placeholder={viewData.devicePlaceholder}
            style={styles.input}
            testID="settings-sync-device-label-input"
            value={preferences.deviceLabel}
          />
          <Text style={styles.helperText}>{viewData.deviceHint}</Text>
        </View>

        <View style={styles.statusGrid}>
          <View style={styles.statusCard}>
            <Text style={styles.statusLabel}>{viewData.stateLabel}</Text>
            <Text style={styles.statusValue}>
              {hasStoredSyncSecrets ? viewData.stateReady : viewData.stateMissing}
            </Text>
          </View>
          <View style={styles.statusCard}>
            <Text style={styles.statusLabel}>{viewData.modeRowLabel}</Text>
            <Text style={styles.statusValue}>{selectedModeLabel}</Text>
          </View>
          <View style={styles.statusCard}>
            <Text style={styles.statusLabel}>{viewData.endpointRowLabel}</Text>
            <Text style={styles.statusValue}>{endpointSummary}</Text>
          </View>
          <View style={styles.statusCard}>
            <Text style={styles.statusLabel}>{viewData.encryptionRowLabel}</Text>
            <Text style={styles.statusValue}>
              {hasStoredSyncSecrets
                ? viewData.encryptionReady
                : viewData.encryptionMissing}
            </Text>
          </View>
        </View>

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

        <AppButton
          disabled={isPreparing}
          label={actionLabel}
          onPress={onPrepare}
          testID="settings-sync-prepare-button"
          variant="secondary"
        />
      </View>
    </FeatureCard>
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
    statusGrid: {
      gap: spacing.sm,
    },
    statusCard: {
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.border,
      borderRadius: 16,
      borderWidth: 1,
      gap: spacing.xs,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    statusLabel: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "700",
    },
    statusValue: {
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 18,
    },
    recoveryCard: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 18,
      borderWidth: 1,
      gap: spacing.sm,
      padding: spacing.md,
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
  });
