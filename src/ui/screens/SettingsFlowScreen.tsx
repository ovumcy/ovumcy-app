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
import { AppScreenSurface } from "../components/AppScreenSurface";
import { SettingsDangerZoneSection } from "../components/SettingsDangerZoneSection";
import { SettingsExportSection } from "../components/SettingsExportSection";
import { SettingsInterfaceSection } from "../components/SettingsInterfaceSection";
import { SettingsSyncSummaryCard } from "../components/SettingsSyncSummaryCard";
import { SettingsSymptomsSection } from "../components/SettingsSymptomsSection";
import { spacing } from "../theme/tokens";
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
  cycleGuidance: {
    adjusted: boolean;
    cycleShort: boolean;
    periodLong: boolean;
  };
  cycleErrorMessage: string;
  cycleStatusMessage: string;
  exportErrorMessage: string;
  exportStatusMessage: string;
  interfaceErrorMessage: string;
  interfaceStatusMessage: string;
  isClearingData: boolean;
  isExporting: boolean;
  isSavingCycle: boolean;
  isSavingInterface: boolean;
  isSavingTracking: boolean;
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
  onDatePickerChange: (event: DateTimePickerEvent, value: Date | undefined) => void;
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
  onOpenBackupSync: () => void | Promise<void>;
  onPeriodLengthChange: (value: number) => void;
  onPredictionModeSelect: (value: PredictionMode) => void;
  onRestoreSymptom: (symptomID: SymptomID) => void | Promise<void>;
  onSaveCycleSettings: () => void | Promise<void>;
  onSaveInterfaceSettings: () => void | Promise<void>;
  onSaveTrackingSettings: () => void | Promise<void>;
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
  cycleGuidance,
  cycleErrorMessage,
  cycleStatusMessage,
  exportErrorMessage,
  exportStatusMessage,
  interfaceErrorMessage,
  interfaceStatusMessage,
  isClearingData,
  isExporting,
  isSavingCycle,
  isSavingInterface,
  isSavingTracking,
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
  onDatePickerChange,
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
  onOpenBackupSync,
  onPeriodLengthChange,
  onPredictionModeSelect,
  onRestoreSymptom,
  onSaveCycleSettings,
  onSaveInterfaceSettings,
  onSaveTrackingSettings,
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

          <SettingsCycleSection
            cycleErrorMessage={cycleErrorMessage}
            cycleGuidance={cycleGuidance}
            cyclePickerMaximumDate={flowState.cyclePickerMaximumDate}
            cyclePickerMinimumDate={flowState.cyclePickerMinimumDate}
            cyclePickerValue={flowState.cyclePickerValue}
            cycleStatusMessage={cycleStatusMessage}
            displayedCycleStartDate={flowState.displayedCycleStartDate}
            isSavingCycle={isSavingCycle}
            now={now}
            onAgeGroupSelect={onAgeGroupSelect}
            onAutoPeriodFillChange={onAutoPeriodFillChange}
            onClearLastPeriodStart={onClearLastPeriodStart}
            onCycleLengthChange={onCycleLengthChange}
            onDatePickerChange={onDatePickerChange}
            onDatePickerToggle={onDatePickerToggle}
            onPeriodLengthChange={onPeriodLengthChange}
            onPredictionModeSelect={onPredictionModeSelect}
            onSaveCycleSettings={onSaveCycleSettings}
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
            isSavingTracking={isSavingTracking}
            onHideSexChipChange={onHideSexChipChange}
            onSaveTrackingSettings={onSaveTrackingSettings}
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
            isSaving={isSavingInterface}
            onLanguageSelect={onInterfaceLanguageSelect}
            onSave={onSaveInterfaceSettings}
            onThemeSelect={onInterfaceThemeSelect}
            statusMessage={interfaceStatusMessage}
            value={state.interfaceValues}
            viewData={viewData.interface}
          />

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
