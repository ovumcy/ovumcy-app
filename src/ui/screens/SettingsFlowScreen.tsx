import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { Platform, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type {
  InterfaceLanguage,
  PredictionMode,
  ThemePreference,
} from "../../models/profile";
import type { SymptomID } from "../../models/symptom";
import type { SymptomDraftValues } from "../../services/symptom-policy";
import {
  buildSettingsFlowPresentationState,
  type LoadedSettingsState,
  type SettingsSyncSummaryViewData,
  type SettingsViewData,
} from "../../services/settings-view-service";
import { AppButton } from "../components/AppButton";
import { AppScreenSurface } from "../components/AppScreenSurface";
import { SettingsDangerZoneSection } from "../components/SettingsDangerZoneSection";
import { SettingsExportSection } from "../components/SettingsExportSection";
import { SettingsInterfaceSection } from "../components/SettingsInterfaceSection";
import { SettingsSyncSummaryCard } from "../components/SettingsSyncSummaryCard";
import { SettingsSymptomsSection } from "../components/SettingsSymptomsSection";
import { resolveBottomContentPadding } from "../layout/bottom-content-padding";
import { useThemedStyles } from "../theme/useThemedStyles";
import { SettingsCycleSection } from "./settings/SettingsCycleSection";
import { createSettingsFlowStyles } from "./settings/settings-flow-styles";
import { SettingsTrackingSection } from "./settings/SettingsTrackingSection";

export type SettingsFlowScreenProps = {
  createSymptomDraft: SymptomDraftValues;
  createSymptomErrorMessage: string;
  createSymptomStatusMessage: string;
  clearDataConfirmationValue: string;
  clearDataErrorMessage: string;
  clearDataStatusMessage: string;
  cycleDateInputValue: string;
  cycleGuidance: {
    adjusted: boolean;
    invalid: boolean;
    cycleLong: boolean;
    cycleShort: boolean;
    periodLong: boolean;
  };
  cycleErrorMessage: string;
  cycleStatusMessage: string;
  exportErrorMessage: string;
  exportStatusMessage: string;
  hasUnsavedSettingsChanges: boolean;
  interfaceErrorMessage: string;
  interfaceStatusMessage: string;
  isClearingData: boolean;
  isExporting: boolean;
  isSavingSettings: boolean;
  locale: string;
  now: Date;
  onAgeGroupSelect: (value: LoadedSettingsState["cycleValues"]["ageGroup"]) => void;
  onArchiveSymptom: (symptomID: SymptomID) => void | Promise<void>;
  onAutoPeriodFillChange: (value: boolean) => void;
  onClearAllData: () => void | Promise<void>;
  onClearDataConfirmationChange: (value: string) => void;
  onClearLastPeriodStart: () => void;
  onCreateSymptom: () => void | Promise<void>;
  onCreateSymptomDraftChange: (updates: Partial<SymptomDraftValues>) => void;
  onCycleLengthChange: (value: number) => void;
  onCycleDateInputChange: (value: string) => void;
  onDatePickerCancel: () => void;
  onDatePickerChange: (event: DateTimePickerEvent, value: Date | undefined) => void;
  onDatePickerConfirm: () => void;
  onDatePickerToggle: () => void;
  onExportCSV: () => void | Promise<void>;
  onExportDatePickerChange: (
    event: DateTimePickerEvent,
    value: Date | undefined,
  ) => void;
  onExportFromDateChange: (value: string) => void;
  onExportFromDatePress: () => void;
  onExportJSON: () => void | Promise<void>;
  onExportPDF: () => void | Promise<void>;
  onExportPresetSelect: (value: "all" | "30" | "90" | "365") => void;
  onExportToDateChange: (value: string) => void;
  onExportToDatePress: () => void;
  onHideSexChipChange: (value: boolean) => void;
  onInterfaceLanguageSelect: (value: InterfaceLanguage) => void;
  onInterfaceThemeSelect: (value: ThemePreference) => void;
  onScreenCaptureProtectionChange: (value: boolean) => void;
  onOpenBackupSync: () => void | Promise<void>;
  onPeriodLengthChange: (value: number) => void;
  onPredictionModeSelect: (value: PredictionMode) => void;
  onRestoreSymptom: (symptomID: SymptomID) => void | Promise<void>;
  onSavePendingSettings: () => void | Promise<void>;
  onSymptomDraftChange: (
    symptomID: SymptomID,
    updates: Partial<SymptomDraftValues>,
  ) => void;
  onTemperatureUnitSelect: (
    value: LoadedSettingsState["trackingValues"]["temperatureUnit"],
  ) => void;
  onTrackBBTChange: (value: boolean) => void;
  onTrackCervicalMucusChange: (value: boolean) => void;
  onUpdateSymptom: (symptomID: SymptomID) => void | Promise<void>;
  onUsageGoalSelect: (value: LoadedSettingsState["cycleValues"]["usageGoal"]) => void;
  rowSymptomDrafts: Record<string, SymptomDraftValues>;
  rowSymptomErrorMessages: Record<string, string>;
  rowSymptomStatusMessages: Record<string, string>;
  showDatePicker: boolean;
  showExportDatePicker: "from" | "to" | null;
  state: LoadedSettingsState;
  syncSummary: SettingsSyncSummaryViewData;
  trackingStatusMessage: string;
  viewData: SettingsViewData;
};

export function SettingsFlowScreen({
  createSymptomDraft,
  createSymptomErrorMessage,
  createSymptomStatusMessage,
  clearDataConfirmationValue,
  clearDataErrorMessage,
  clearDataStatusMessage,
  cycleDateInputValue,
  cycleGuidance,
  cycleErrorMessage,
  cycleStatusMessage,
  exportErrorMessage,
  exportStatusMessage,
  hasUnsavedSettingsChanges,
  interfaceErrorMessage,
  interfaceStatusMessage,
  isClearingData,
  isExporting,
  isSavingSettings,
  locale,
  now,
  onAgeGroupSelect,
  onArchiveSymptom,
  onAutoPeriodFillChange,
  onClearAllData,
  onClearDataConfirmationChange,
  onClearLastPeriodStart,
  onCreateSymptom,
  onCreateSymptomDraftChange,
  onCycleLengthChange,
  onCycleDateInputChange,
  onDatePickerCancel,
  onDatePickerChange,
  onDatePickerConfirm,
  onDatePickerToggle,
  onExportCSV,
  onExportDatePickerChange,
  onExportFromDateChange,
  onExportFromDatePress,
  onExportJSON,
  onExportPDF,
  onExportPresetSelect,
  onExportToDateChange,
  onExportToDatePress,
  onHideSexChipChange,
  onInterfaceLanguageSelect,
  onInterfaceThemeSelect,
  onScreenCaptureProtectionChange,
  onOpenBackupSync,
  onPeriodLengthChange,
  onPredictionModeSelect,
  onRestoreSymptom,
  onSavePendingSettings,
  onSymptomDraftChange,
  onTemperatureUnitSelect,
  onTrackBBTChange,
  onTrackCervicalMucusChange,
  onUpdateSymptom,
  onUsageGoalSelect,
  rowSymptomDrafts,
  rowSymptomErrorMessages,
  rowSymptomStatusMessages,
  showDatePicker,
  showExportDatePicker,
  state,
  syncSummary,
  trackingStatusMessage,
  viewData,
}: SettingsFlowScreenProps) {
  const styles = useThemedStyles(createSettingsFlowStyles);
  const insets = useSafeAreaInsets();
  const flowState = buildSettingsFlowPresentationState(
    state,
    viewData,
    locale,
    now,
    Platform.OS,
    showExportDatePicker,
  );

  return (
    <AppScreenSurface>
      <ScrollView
        contentContainerStyle={[
          styles.screenContent,
          { paddingBottom: resolveBottomContentPadding(insets.bottom) },
        ]}
        showsVerticalScrollIndicator={false}
        style={styles.screen}
      >
        <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>{viewData.title}</Text>
            <Text style={styles.headerDescription}>{viewData.description}</Text>
          </View>

          <SettingsCycleSection
            cycleErrorMessage={cycleErrorMessage}
            cycleDateInputValue={cycleDateInputValue}
            cycleGuidance={cycleGuidance}
            cyclePickerMaximumDate={flowState.cyclePickerMaximumDate}
            cyclePickerMinimumDate={flowState.cyclePickerMinimumDate}
            cyclePickerValue={flowState.cyclePickerValue}
            cycleStatusMessage={cycleStatusMessage}
            displayedCycleStartDate={flowState.displayedCycleStartDate}
            now={now}
            onAgeGroupSelect={onAgeGroupSelect}
            onAutoPeriodFillChange={onAutoPeriodFillChange}
            onClearLastPeriodStart={onClearLastPeriodStart}
            onCycleLengthChange={onCycleLengthChange}
            onCycleDateInputChange={onCycleDateInputChange}
            onDatePickerCancel={onDatePickerCancel}
            onDatePickerChange={onDatePickerChange}
            onDatePickerConfirm={onDatePickerConfirm}
            onDatePickerToggle={onDatePickerToggle}
            onPeriodLengthChange={onPeriodLengthChange}
            onPredictionModeSelect={onPredictionModeSelect}
            onUsageGoalSelect={onUsageGoalSelect}
            predictionMode={flowState.predictionMode}
            showDatePicker={showDatePicker}
            state={state}
            styles={styles}
            supportsNativeDatePicker={flowState.exportSection.supportsNativeDatePicker}
            viewData={viewData}
          />

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
            visibleState={flowState.symptomsState}
          />

          <SettingsTrackingSection
            onHideSexChipChange={onHideSexChipChange}
            onTemperatureUnitSelect={onTemperatureUnitSelect}
            onTrackBBTChange={onTrackBBTChange}
            onTrackCervicalMucusChange={onTrackCervicalMucusChange}
            state={state}
            styles={styles}
            trackingStatusMessage={trackingStatusMessage}
            viewData={viewData}
          />

          <SettingsInterfaceSection
            errorMessage={interfaceErrorMessage}
            onLanguageSelect={onInterfaceLanguageSelect}
            onScreenCaptureProtectionChange={onScreenCaptureProtectionChange}
            onThemeSelect={onInterfaceThemeSelect}
            statusMessage={interfaceStatusMessage}
            value={state.interfaceValues}
            viewData={viewData.interface}
          />

          <View style={styles.formGroup}>
            <AppButton
              disabled={
                !hasUnsavedSettingsChanges || isSavingSettings || cycleGuidance.invalid
              }
              label={
                isSavingSettings
                  ? viewData.common.saving
                  : viewData.common.saveChanges
              }
              onPress={onSavePendingSettings}
              testID="settings-save-all-button"
            />
          </View>

          <SettingsSyncSummaryCard onOpen={onOpenBackupSync} summary={syncSummary} />

          <SettingsExportSection
            errorMessage={exportErrorMessage}
            exportState={state.exportState}
            isExporting={isExporting}
            onCSVExport={onExportCSV}
            onFromDateChange={onExportFromDateChange}
            onFromDatePress={onExportFromDatePress}
            onJSONExport={onExportJSON}
            onPDFExport={onExportPDF}
            onPresetSelect={onExportPresetSelect}
            onToDateChange={onExportToDateChange}
            onToDatePress={onExportToDatePress}
            presentationState={flowState.exportSection}
            statusMessage={exportStatusMessage}
            viewData={viewData.export}
          />

          {flowState.exportSection.supportsNativeDatePicker && showExportDatePicker ? (
            <DateTimePicker
              display="default"
              maximumDate={flowState.exportPickerMaximumDate ?? now}
              mode="date"
              onChange={onExportDatePickerChange}
              {...(flowState.exportPickerMinimumDate
                ? { minimumDate: flowState.exportPickerMinimumDate }
                : {})}
              testID="settings-export-date-picker"
              value={flowState.exportPickerValue}
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
