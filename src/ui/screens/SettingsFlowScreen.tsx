import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { InterfaceLanguage, ThemePreference } from "../../models/profile";
import type { SymptomID } from "../../models/symptom";
import type { SymptomDraftValues } from "../../services/symptom-policy";
import { parseLocalDate } from "../../services/profile-settings-policy";
import {
  buildSettingsSymptomsState,
  type LoadedSettingsState,
  type SettingsViewData,
} from "../../services/settings-view-service";
import { AppButton } from "../components/AppButton";
import { AppScreenSurface } from "../components/AppScreenSurface";
import { BinaryToggleCard } from "../components/BinaryToggleCard";
import { ChoiceGroup } from "../components/ChoiceGroup";
import { FeatureCard } from "../components/FeatureCard";
import { LabeledSliderField } from "../components/LabeledSliderField";
import { SettingsDangerZoneSection } from "../components/SettingsDangerZoneSection";
import { SettingsExportSection } from "../components/SettingsExportSection";
import { SettingsInterfaceSection } from "../components/SettingsInterfaceSection";
import { SettingsSyncSetupSection } from "../components/SettingsSyncSetupSection";
import { StatusBanner } from "../components/StatusBanner";
import { SettingsSymptomsSection } from "../components/SettingsSymptomsSection";
import type { AppThemeColors } from "../theme/tokens";
import { spacing } from "../theme/tokens";
import { useThemedStyles } from "../theme/useThemedStyles";

type SettingsFlowScreenProps = {
  accountLoginValue: string;
  accountPasswordValue: string;
  createSymptomDraft: SymptomDraftValues;
  createSymptomErrorMessage: string;
  createSymptomStatusMessage: string;
  clearDataConfirmationValue: string;
  clearDataErrorMessage: string;
  clearDataStatusMessage: string;
  accountErrorMessage: string;
  accountStatusMessage: string;
  cycleGuidance: {
    adjusted: boolean;
    periodLong: boolean;
    cycleShort: boolean;
  };
  cycleStatusMessage: string;
  cycleErrorMessage: string;
  exportErrorMessage: string;
  exportStatusMessage: string;
  generatedRecoveryPhrase: string;
  interfaceErrorMessage: string;
  interfaceStatusMessage: string;
  isAuthenticatingSync: boolean;
  isExporting: boolean;
  isPreparingSync: boolean;
  isRestoringSync: boolean;
  isSavingCycle: boolean;
  isSavingInterface: boolean;
  isSavingTracking: boolean;
  isSyncingNow: boolean;
  locale: string;
  now: Date;
  onAgeGroupSelect: (value: LoadedSettingsState["cycleValues"]["ageGroup"]) => void;
  onArchiveSymptom: (symptomID: SymptomID) => void | Promise<void>;
  onAutoPeriodFillChange: (value: boolean) => void;
  onClearDataConfirmationChange: (value: string) => void;
  onClearAllData: () => void | Promise<void>;
  onClearLastPeriodStart: () => void;
  onCreateSymptom: () => void | Promise<void>;
  onCreateSymptomDraftChange: (updates: Partial<SymptomDraftValues>) => void;
  onCycleLengthChange: (value: number) => void;
  onDatePickerChange: (event: DateTimePickerEvent, value: Date | undefined) => void;
  onDatePickerToggle: () => void;
  onExportCSV: () => void | Promise<void>;
  onExportDatePickerChange: (
    event: DateTimePickerEvent,
    value: Date | undefined,
  ) => void;
  onExportFromDatePress: () => void;
  onExportFromDateChange: (value: string) => void;
  onExportJSON: () => void | Promise<void>;
  onExportPDF: () => void | Promise<void>;
  onExportPresetSelect: (value: "all" | "30" | "90" | "365") => void;
  onExportToDatePress: () => void;
  onExportToDateChange: (value: string) => void;
  onConnectSyncLogin: () => void | Promise<void>;
  onConnectSyncRegister: () => void | Promise<void>;
  onDisconnectSync: () => void | Promise<void>;
  onPrepareSyncSetup: () => void | Promise<void>;
  onRestoreSync: () => void | Promise<void>;
  onSyncLoginValueChange: (value: string) => void;
  onInterfaceLanguageSelect: (value: InterfaceLanguage) => void;
  onSyncPasswordValueChange: (value: string) => void;
  onSyncNow: () => void | Promise<void>;
  onInterfaceThemeSelect: (value: ThemePreference) => void;
  onIrregularCycleChange: (value: boolean) => void;
  onPeriodLengthChange: (value: number) => void;
  onRestoreSymptom: (symptomID: SymptomID) => void | Promise<void>;
  onSaveCycleSettings: () => void | Promise<void>;
  onSaveInterfaceSettings: () => void | Promise<void>;
  onSaveTrackingSettings: () => void | Promise<void>;
  onSyncDeviceLabelChange: (value: string) => void;
  onSyncEndpointChange: (value: string) => void;
  onSyncModeSelect: (value: LoadedSettingsState["syncPreferences"]["mode"]) => void;
  onSymptomDraftChange: (
    symptomID: SymptomID,
    updates: Partial<SymptomDraftValues>,
  ) => void;
  onTemperatureUnitSelect: (
    value: LoadedSettingsState["trackingValues"]["temperatureUnit"],
  ) => void;
  onTrackBBTChange: (value: boolean) => void;
  onTrackCervicalMucusChange: (value: boolean) => void;
  onHideSexChipChange: (value: boolean) => void;
  onUnpredictableCycleChange: (value: boolean) => void;
  onUpdateSymptom: (symptomID: SymptomID) => void | Promise<void>;
  onUsageGoalSelect: (value: LoadedSettingsState["cycleValues"]["usageGoal"]) => void;
  rowSymptomDrafts: Record<string, SymptomDraftValues>;
  rowSymptomErrorMessages: Record<string, string>;
  rowSymptomStatusMessages: Record<string, string>;
  showExportDatePicker: "from" | "to" | null;
  showDatePicker: boolean;
  state: LoadedSettingsState;
  trackingStatusMessage: string;
  viewData: SettingsViewData;
  isClearingData: boolean;
};

export function SettingsFlowScreen({
  accountLoginValue,
  accountPasswordValue,
  accountErrorMessage,
  accountStatusMessage,
  createSymptomDraft,
  createSymptomErrorMessage,
  createSymptomStatusMessage,
  clearDataConfirmationValue,
  clearDataErrorMessage,
  clearDataStatusMessage,
  cycleGuidance,
  cycleStatusMessage,
  cycleErrorMessage,
  exportErrorMessage,
  exportStatusMessage,
  generatedRecoveryPhrase,
  interfaceErrorMessage,
  interfaceStatusMessage,
  isAuthenticatingSync,
  isExporting,
  isPreparingSync,
  isRestoringSync,
  isSavingCycle,
  isSavingInterface,
  isSavingTracking,
  isClearingData,
  isSyncingNow,
  locale,
  now,
  onAgeGroupSelect,
  onArchiveSymptom,
  onAutoPeriodFillChange,
  onClearDataConfirmationChange,
  onClearAllData,
  onClearLastPeriodStart,
  onCreateSymptom,
  onCreateSymptomDraftChange,
  onCycleLengthChange,
  onDatePickerChange,
  onDatePickerToggle,
  onExportCSV,
  onExportDatePickerChange,
  onExportFromDatePress,
  onExportFromDateChange,
  onExportJSON,
  onExportPDF,
  onExportPresetSelect,
  onExportToDatePress,
  onExportToDateChange,
  onConnectSyncLogin,
  onConnectSyncRegister,
  onDisconnectSync,
  onPrepareSyncSetup,
  onRestoreSync,
  onSyncLoginValueChange,
  onInterfaceLanguageSelect,
  onSyncPasswordValueChange,
  onSyncNow,
  onInterfaceThemeSelect,
  onHideSexChipChange,
  onIrregularCycleChange,
  onPeriodLengthChange,
  onRestoreSymptom,
  onSaveCycleSettings,
  onSaveInterfaceSettings,
  onSaveTrackingSettings,
  onSyncDeviceLabelChange,
  onSyncEndpointChange,
  onSyncModeSelect,
  onSymptomDraftChange,
  onTemperatureUnitSelect,
  onTrackBBTChange,
  onTrackCervicalMucusChange,
  onUnpredictableCycleChange,
  onUpdateSymptom,
  onUsageGoalSelect,
  rowSymptomDrafts,
  rowSymptomErrorMessages,
  rowSymptomStatusMessages,
  showExportDatePicker,
  showDatePicker,
  state,
  trackingStatusMessage,
  viewData,
}: SettingsFlowScreenProps) {
  const styles = useThemedStyles(createStyles);
  const selectedDate = state.cycleValues.lastPeriodStart
    ? parseLocalDate(state.cycleValues.lastPeriodStart)
    : null;
  const supportsNativeDatePicker = Platform.OS !== "web";
  const insets = useSafeAreaInsets();
  const displayedDate = selectedDate
    ? formatLongDate(selectedDate, locale)
    : viewData.common.notSet;
  const exportPickerValue = resolveExportDatePickerValue(state, showExportDatePicker, now);
  const exportPickerMinimumDate = parseLocalDate(state.exportState.bounds.minDate ?? "");
  const exportPickerMaximumDate = parseLocalDate(state.exportState.bounds.maxDate ?? "");
  const symptomsState = buildSettingsSymptomsState(state.symptomRecords);

  return (
    <AppScreenSurface>
      <ScrollView
        contentContainerStyle={[
          styles.screenContent,
          { paddingBottom: Math.max(insets.bottom + 104, spacing.xl + 48) },
        ]}
        showsVerticalScrollIndicator={false}
        style={styles.screen}
      >
        <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{viewData.title}</Text>
        <Text style={styles.headerDescription}>{viewData.description}</Text>
      </View>

      <FeatureCard
        title={viewData.cycle.title}
        testID="settings-cycle-section"
      >
        <LabeledSliderField
          label={viewData.cycle.cycleLengthLabel}
          maximumValue={90}
          minimumValue={15}
          onValueChange={(value) => onCycleLengthChange(Math.round(value))}
          testID="settings-cycle-length-slider"
          value={state.cycleValues.cycleLength}
          valueSuffix={` ${viewData.common.daysShort}`}
        />

        <LabeledSliderField
          label={viewData.cycle.periodLengthLabel}
          maximumValue={14}
          minimumValue={1}
          onValueChange={(value) => onPeriodLengthChange(Math.round(value))}
          testID="settings-period-length-slider"
          value={state.cycleValues.periodLength}
          valueSuffix={` ${viewData.common.daysShort}`}
        />

        <View style={styles.formGroup}>
          <Text style={styles.fieldLabel}>{viewData.cycle.lastPeriodStartLabel}</Text>
          {supportsNativeDatePicker ? (
            <Pressable
              accessibilityRole="button"
              onPress={onDatePickerToggle}
              style={styles.dateFieldShell}
              testID="settings-cycle-date-field-button"
            >
              <Text
                style={[
                  styles.dateFieldValue,
                  !state.cycleValues.lastPeriodStart ? styles.dateFieldValueMuted : null,
                ]}
              >
                {state.cycleValues.lastPeriodStart ? displayedDate : viewData.common.notSet}
              </Text>
              {state.cycleValues.lastPeriodStart ? (
                <View style={styles.dateActionRow}>
                  <Pressable onPress={onClearLastPeriodStart} style={styles.inlineAction}>
                    <Text style={styles.inlineActionText}>
                      {viewData.common.clearDate}
                    </Text>
                  </Pressable>
                </View>
              ) : null}
            </Pressable>
          ) : (
            <View style={styles.dateFieldShell}>
              <Text
                style={[
                  styles.dateFieldValue,
                  !state.cycleValues.lastPeriodStart ? styles.dateFieldValueMuted : null,
                ]}
              >
                {state.cycleValues.lastPeriodStart ? displayedDate : viewData.common.notSet}
              </Text>
              <View style={styles.dateActionRow}>
                <Pressable onPress={onDatePickerToggle} style={styles.inlineAction}>
                  <Text style={styles.inlineActionText}>
                    {viewData.common.changeDate}
                  </Text>
                </Pressable>
                {state.cycleValues.lastPeriodStart ? (
                  <Pressable onPress={onClearLastPeriodStart} style={styles.inlineAction}>
                    <Text style={styles.inlineActionText}>
                      {viewData.common.clearDate}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          )}
          {supportsNativeDatePicker && showDatePicker ? (
            <DateTimePicker
              display="default"
              mode="date"
              maximumDate={parseLocalDate(viewData.cycle.dateBounds.maxDate) ?? now}
              minimumDate={parseLocalDate(viewData.cycle.dateBounds.minDate) ?? now}
              onChange={onDatePickerChange}
              value={
                selectedDate ??
                parseLocalDate(viewData.cycle.dateBounds.maxDate) ??
                now
              }
            />
          ) : null}
          <Text style={styles.helperText}>{viewData.cycle.lastPeriodStartHint}</Text>
        </View>

        <View style={styles.messageStack}>
          {cycleGuidance.adjusted ? (
            <Text style={styles.infoText}>{viewData.cycle.messages.infoAdjusted}</Text>
          ) : null}
          {cycleGuidance.periodLong ? (
            <Text style={styles.infoText}>{viewData.cycle.messages.infoPeriodLong}</Text>
          ) : null}
          {cycleGuidance.cycleShort ? (
            <Text style={styles.infoText}>{viewData.cycle.messages.infoCycleShort}</Text>
          ) : null}
        </View>
        {cycleErrorMessage ? (
          <StatusBanner
            message={cycleErrorMessage}
            tone="error"
            testID="settings-cycle-error-banner"
          />
        ) : null}
        {cycleStatusMessage ? (
          <StatusBanner
            message={cycleStatusMessage}
            tone="success"
            testID="settings-cycle-status-banner"
          />
        ) : null}

        <BinaryToggleCard
          description={viewData.cycle.autoPeriodFillHint}
          descriptionPosition="below"
          icon="🩸"
          label={viewData.cycle.autoPeriodFillLabel}
          onValueChange={onAutoPeriodFillChange}
          testID="settings-toggle-auto-period-fill"
          value={state.cycleValues.autoPeriodFill}
        />

        <BinaryToggleCard
          description={viewData.cycle.irregularCycleHint}
          descriptionPosition="below"
          icon="〰️"
          label={viewData.cycle.irregularCycleLabel}
          onValueChange={onIrregularCycleChange}
          testID="settings-toggle-irregular-cycle"
          value={state.cycleValues.irregularCycle}
        />

        <BinaryToggleCard
          description={viewData.cycle.unpredictableCycleHint}
          descriptionPosition="below"
          icon="∞"
          label={viewData.cycle.unpredictableCycleLabel}
          onValueChange={onUnpredictableCycleChange}
          testID="settings-toggle-unpredictable-cycle"
          value={state.cycleValues.unpredictableCycle}
        />

        <View style={styles.formGroup}>
          <Text style={styles.fieldLabel}>{viewData.ageGroup.label}</Text>
          <Text style={styles.helperText}>{viewData.ageGroup.hint}</Text>
          <ChoiceGroup
            layout="grid3"
            onSelect={onAgeGroupSelect}
            options={viewData.ageGroup.options}
            selectedValue={state.cycleValues.ageGroup}
            testIDPrefix="settings-age-group"
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.fieldLabel}>{viewData.usageGoal.label}</Text>
          <Text style={styles.helperText}>{viewData.usageGoal.hint}</Text>
          <ChoiceGroup
            onSelect={onUsageGoalSelect}
            options={viewData.usageGoal.options}
            selectedValue={state.cycleValues.usageGoal}
            testIDPrefix="settings-usage-goal"
          />
        </View>

        <AppButton
          disabled={isSavingCycle}
          label={viewData.cycle.saveLabel}
          onPress={onSaveCycleSettings}
          testID="settings-save-cycle-button"
        />
      </FeatureCard>

      <SettingsSymptomsSection
        createDraft={createSymptomDraft}
        createErrorMessage={createSymptomErrorMessage}
        createStatusMessage={createSymptomStatusMessage}
        onArchive={onArchiveSymptom}
        onCreate={onCreateSymptom}
        onCreateDraftChange={onCreateSymptomDraftChange}
        onRestore={onRestoreSymptom}
        onRowDraftChange={onSymptomDraftChange}
        onUpdate={onUpdateSymptom}
        rowDrafts={rowSymptomDrafts}
        rowErrorMessages={rowSymptomErrorMessages}
        rowStatusMessages={rowSymptomStatusMessages}
        viewData={viewData.symptoms}
        visibleState={symptomsState}
      />

      <FeatureCard
        title={viewData.tracking.title}
        description={viewData.tracking.subtitle}
        testID="settings-tracking-section"
      >
        <BinaryToggleCard
          description={viewData.tracking.trackBBT.hint}
          descriptionPosition="below"
          icon="🌡️"
          label={viewData.tracking.trackBBT.label}
          onValueChange={onTrackBBTChange}
          testID="settings-toggle-track-bbt"
          value={state.trackingValues.trackBBT}
        />

        <BinaryToggleCard
          description={viewData.tracking.trackCervicalMucus.hint}
          descriptionPosition="below"
          icon="💧"
          label={viewData.tracking.trackCervicalMucus.label}
          onValueChange={onTrackCervicalMucusChange}
          testID="settings-toggle-track-cervical-mucus"
          value={state.trackingValues.trackCervicalMucus}
        />

        <BinaryToggleCard
          description={viewData.tracking.hideSexChip.hint}
          descriptionPosition="below"
          icon="◦"
          label={viewData.tracking.hideSexChip.label}
          onValueChange={onHideSexChipChange}
          testID="settings-toggle-hide-sex-chip"
          value={state.trackingValues.hideSexChip}
        />

        <View style={styles.formGroup}>
          <Text style={styles.fieldLabel}>{viewData.tracking.temperatureUnit.label}</Text>
          <Text style={styles.helperText}>{viewData.tracking.temperatureUnit.hint}</Text>
          <ChoiceGroup
            layout="grid2"
            onSelect={onTemperatureUnitSelect}
            options={viewData.tracking.temperatureUnit.options}
            selectedValue={state.trackingValues.temperatureUnit}
            testIDPrefix="settings-temperature-unit"
          />
        </View>

        {trackingStatusMessage ? (
          <StatusBanner
            message={trackingStatusMessage}
            tone="success"
            testID="settings-tracking-status-banner"
          />
        ) : null}

        <AppButton
          disabled={isSavingTracking}
          label={viewData.tracking.saveLabel}
          onPress={onSaveTrackingSettings}
          testID="settings-save-tracking-button"
          variant="secondary"
        />
      </FeatureCard>

      <SettingsInterfaceSection
        errorMessage={interfaceErrorMessage}
        isSaving={isSavingInterface}
        onLanguageSelect={onInterfaceLanguageSelect}
        onSave={onSaveInterfaceSettings}
        onThemeSelect={onInterfaceThemeSelect}
        statusMessage={interfaceStatusMessage}
        value={state.interfaceValues}
        viewData={viewData.interface}
      />

      <SettingsSyncSetupSection
        authLoginValue={accountLoginValue}
        authPasswordValue={accountPasswordValue}
        errorMessage={accountErrorMessage}
        generatedRecoveryPhrase={generatedRecoveryPhrase}
        hasSyncSession={state.hasSyncSession}
        hasStoredSyncSecrets={state.hasStoredSyncSecrets}
        isAuthenticating={isAuthenticatingSync}
        isPreparing={isPreparingSync}
        isRestoring={isRestoringSync}
        isSyncing={isSyncingNow}
        notSetLabel={viewData.common.notSet}
        onAuthLoginChange={onSyncLoginValueChange}
        onAuthPasswordChange={onSyncPasswordValueChange}
        onDisconnect={onDisconnectSync}
        onDeviceLabelChange={onSyncDeviceLabelChange}
        onEndpointChange={onSyncEndpointChange}
        onLogin={onConnectSyncLogin}
        onModeSelect={onSyncModeSelect}
        onPrepare={onPrepareSyncSetup}
        onRegister={onConnectSyncRegister}
        onRestore={onRestoreSync}
        onSyncNow={onSyncNow}
        preferences={state.syncPreferences}
        statusMessage={accountStatusMessage}
        viewData={viewData.account}
      />

      <SettingsExportSection
        errorMessage={exportErrorMessage}
        exportState={state.exportState}
        isExporting={isExporting}
        onCSVExport={onExportCSV}
        onFromDatePress={onExportFromDatePress}
        onFromDateChange={onExportFromDateChange}
        onJSONExport={onExportJSON}
        onPDFExport={onExportPDF}
        onPresetSelect={onExportPresetSelect}
        onToDatePress={onExportToDatePress}
        onToDateChange={onExportToDateChange}
        statusMessage={exportStatusMessage}
        viewData={viewData.export}
      />
      {supportsNativeDatePicker && showExportDatePicker ? (
        <DateTimePicker
          display="default"
          maximumDate={exportPickerMaximumDate ?? now}
          mode="date"
          onChange={onExportDatePickerChange}
          {...(exportPickerMinimumDate ? { minimumDate: exportPickerMinimumDate } : {})}
          testID="settings-export-date-picker"
          value={exportPickerValue}
        />
      ) : null}

      <SettingsDangerZoneSection
        confirmationValue={clearDataConfirmationValue}
        errorMessage={clearDataErrorMessage}
        isClearingData={isClearingData}
        onChangeConfirmationValue={onClearDataConfirmationChange}
        onSubmit={onClearAllData}
        statusMessage={clearDataStatusMessage}
        viewData={viewData.danger}
      />
        </View>
      </ScrollView>
    </AppScreenSurface>
  );
}

function formatLongDate(value: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(value);
}

function resolveExportDatePickerValue(
  state: LoadedSettingsState,
  target: "from" | "to" | null,
  fallback: Date,
): Date {
  if (target === "from") {
    return (
      parseLocalDate(state.exportState.values.fromDate) ??
      parseLocalDate(state.exportState.bounds.minDate ?? "") ??
      fallback
    );
  }
  if (target === "to") {
    return (
      parseLocalDate(state.exportState.values.toDate) ??
      parseLocalDate(state.exportState.bounds.maxDate ?? "") ??
      fallback
    );
  }

  return fallback;
}

const createStyles = (colors: AppThemeColors) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: "transparent",
    },
    screenContent: {
      paddingBottom: spacing.xl,
    },
    container: {
      alignSelf: "center",
      gap: spacing.md,
      maxWidth: 1080,
      paddingHorizontal: 16,
      paddingTop: 16,
      width: "100%",
    },
    header: {
      gap: 6,
    },
    headerTitle: {
      color: colors.text,
      fontSize: 29,
      fontWeight: "800",
      lineHeight: 34,
    },
    headerDescription: {
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
    helperText: {
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 21,
    },
    dateFieldShell: {
      backgroundColor: colors.surfaceTint,
      borderColor: colors.lineSoft,
      borderRadius: 16,
      borderWidth: 1,
      gap: spacing.xs,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
    },
    dateFieldValue: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "600",
    },
    dateFieldValueMuted: {
      color: colors.textMuted,
    },
    dateActionRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.md,
    },
    inlineAction: {
      alignSelf: "flex-start",
      paddingTop: spacing.xs,
    },
    inlineActionText: {
      color: colors.accent,
      fontSize: 14,
      fontWeight: "700",
    },
    messageStack: {
      gap: spacing.xs,
    },
    infoText: {
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 21,
    },
  });
