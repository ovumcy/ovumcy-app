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

import type { SymptomID } from "../../models/symptom";
import type { SymptomDraftValues } from "../../services/symptom-policy";
import { parseLocalDate } from "../../services/profile-settings-policy";
import {
  buildSettingsSymptomsState,
  type LoadedSettingsState,
  type SettingsViewData,
} from "../../services/settings-view-service";
import { AppButton } from "../components/AppButton";
import { BinaryToggleCard } from "../components/BinaryToggleCard";
import { ChoiceGroup } from "../components/ChoiceGroup";
import { FeatureCard } from "../components/FeatureCard";
import { LabeledSliderField } from "../components/LabeledSliderField";
import { SettingsDangerZoneSection } from "../components/SettingsDangerZoneSection";
import { SettingsExportSection } from "../components/SettingsExportSection";
import { StatusBanner } from "../components/StatusBanner";
import {
  buildAccountStatusRows,
  buildInterfaceStatusRows,
  SettingsStatusSection,
} from "../components/SettingsStatusSection";
import { SettingsSymptomsSection } from "../components/SettingsSymptomsSection";
import { colors, spacing } from "../theme/tokens";

type SettingsFlowScreenProps = {
  createSymptomDraft: SymptomDraftValues;
  createSymptomErrorMessage: string;
  createSymptomStatusMessage: string;
  clearDataConfirmationValue: string;
  clearDataErrorMessage: string;
  clearDataStatusMessage: string;
  cycleGuidance: {
    adjusted: boolean;
    periodLong: boolean;
    cycleShort: boolean;
  };
  cycleStatusMessage: string;
  cycleErrorMessage: string;
  exportErrorMessage: string;
  exportStatusMessage: string;
  isExporting: boolean;
  isSavingCycle: boolean;
  isSavingTracking: boolean;
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
  onExportFromDateChange: (value: string) => void;
  onExportJSON: () => void | Promise<void>;
  onExportPresetSelect: (value: "all" | "30" | "90" | "365") => void;
  onExportToDateChange: (value: string) => void;
  onIrregularCycleChange: (value: boolean) => void;
  onPeriodLengthChange: (value: number) => void;
  onRestoreSymptom: (symptomID: SymptomID) => void | Promise<void>;
  onSaveCycleSettings: () => void | Promise<void>;
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
  onHideSexChipChange: (value: boolean) => void;
  onUnpredictableCycleChange: (value: boolean) => void;
  onUpdateSymptom: (symptomID: SymptomID) => void | Promise<void>;
  onUsageGoalSelect: (value: LoadedSettingsState["cycleValues"]["usageGoal"]) => void;
  rowSymptomDrafts: Record<string, SymptomDraftValues>;
  rowSymptomErrorMessages: Record<string, string>;
  rowSymptomStatusMessages: Record<string, string>;
  showDatePicker: boolean;
  state: LoadedSettingsState;
  trackingStatusMessage: string;
  viewData: SettingsViewData;
  isClearingData: boolean;
};

export function SettingsFlowScreen({
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
  isExporting,
  isSavingCycle,
  isSavingTracking,
  isClearingData,
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
  onExportFromDateChange,
  onExportJSON,
  onExportPresetSelect,
  onExportToDateChange,
  onHideSexChipChange,
  onIrregularCycleChange,
  onPeriodLengthChange,
  onRestoreSymptom,
  onSaveCycleSettings,
  onSaveTrackingSettings,
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
  showDatePicker,
  state,
  trackingStatusMessage,
  viewData,
}: SettingsFlowScreenProps) {
  const selectedDate = state.cycleValues.lastPeriodStart
    ? parseLocalDate(state.cycleValues.lastPeriodStart)
    : null;
  const supportsNativeDatePicker = Platform.OS !== "web";
  const insets = useSafeAreaInsets();
  const displayedDate = selectedDate
    ? formatLongDate(selectedDate)
    : viewData.common.changeDate;
  const symptomsState = buildSettingsSymptomsState(state.symptomRecords);

  return (
    <ScrollView
      contentContainerStyle={[
        styles.screenContent,
        { paddingBottom: Math.max(insets.bottom + 16, spacing.xl) },
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
        title={`🗓️ ${viewData.cycle.title}`}
        testID="settings-cycle-section"
      >
        <LabeledSliderField
          label={viewData.cycle.cycleLengthLabel}
          maximumValue={90}
          minimumValue={15}
          onValueChange={(value) => onCycleLengthChange(Math.round(value))}
          showRange
          testID="settings-cycle-length-slider"
          value={state.cycleValues.cycleLength}
          valueSuffix={` ${viewData.common.daysShort}`}
        />

        <LabeledSliderField
          label={viewData.cycle.periodLengthLabel}
          maximumValue={14}
          minimumValue={1}
          onValueChange={(value) => onPeriodLengthChange(Math.round(value))}
          showRange
          testID="settings-period-length-slider"
          value={state.cycleValues.periodLength}
          valueSuffix={` ${viewData.common.daysShort}`}
        />

        <View style={styles.formGroup}>
          <Text style={styles.fieldLabel}>{viewData.cycle.lastPeriodStartLabel}</Text>
          <View style={styles.dateFieldShell}>
            <Text
              style={[
                styles.dateFieldValue,
                !state.cycleValues.lastPeriodStart ? styles.dateFieldValueMuted : null,
              ]}
            >
              {state.cycleValues.lastPeriodStart ? displayedDate : "Not set"}
            </Text>
            <View style={styles.dateActionRow}>
              {supportsNativeDatePicker ? (
                <Pressable onPress={onDatePickerToggle} style={styles.inlineAction}>
                  <Text style={styles.inlineActionText}>
                    {viewData.common.changeDate}
                  </Text>
                </Pressable>
              ) : null}
              {state.cycleValues.lastPeriodStart ? (
                <Pressable onPress={onClearLastPeriodStart} style={styles.inlineAction}>
                  <Text style={styles.inlineActionText}>
                    {viewData.common.clearDate}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </View>
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
        title={`🧪 ${viewData.tracking.title}`}
        description={viewData.tracking.subtitle}
        testID="settings-tracking-section"
      >
        <BinaryToggleCard
          description={viewData.tracking.trackBBT.hint}
          icon="🌡️"
          label={viewData.tracking.trackBBT.label}
          onValueChange={onTrackBBTChange}
          stateText={
            state.trackingValues.trackBBT
              ? viewData.tracking.trackBBT.stateOn
              : viewData.tracking.trackBBT.stateOff
          }
          testID="settings-toggle-track-bbt"
          value={state.trackingValues.trackBBT}
        />

        <BinaryToggleCard
          description={viewData.tracking.trackCervicalMucus.hint}
          icon="💧"
          label={viewData.tracking.trackCervicalMucus.label}
          onValueChange={onTrackCervicalMucusChange}
          stateText={
            state.trackingValues.trackCervicalMucus
              ? viewData.tracking.trackCervicalMucus.stateOn
              : viewData.tracking.trackCervicalMucus.stateOff
          }
          testID="settings-toggle-track-cervical-mucus"
          value={state.trackingValues.trackCervicalMucus}
        />

        <BinaryToggleCard
          description={viewData.tracking.hideSexChip.hint}
          icon="◦"
          label={viewData.tracking.hideSexChip.label}
          onValueChange={onHideSexChipChange}
          stateText={
            state.trackingValues.hideSexChip
              ? viewData.tracking.hideSexChip.stateOn
              : viewData.tracking.hideSexChip.stateOff
          }
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

      <SettingsStatusSection
        description={viewData.interface.subtitle}
        rows={buildInterfaceStatusRows(viewData.interface)}
        testID="settings-interface-section"
        title={`🎛️ ${viewData.interface.title}`}
      />

      <SettingsStatusSection
        description={viewData.account.subtitle}
        hint={viewData.account.actionsHint}
        rows={buildAccountStatusRows(viewData.account)}
        testID="settings-account-section"
        title={`👤 ${viewData.account.title}`}
      />

      <SettingsExportSection
        errorMessage={exportErrorMessage}
        exportState={state.exportState}
        isExporting={isExporting}
        onCSVExport={onExportCSV}
        onFromDateChange={onExportFromDateChange}
        onJSONExport={onExportJSON}
        onPresetSelect={onExportPresetSelect}
        onToDateChange={onExportToDateChange}
        statusMessage={exportStatusMessage}
        viewData={viewData.export}
      />

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
  );
}

function formatLongDate(value: Date): string {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(value);
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
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
    backgroundColor: colors.surface,
    borderColor: colors.border,
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
