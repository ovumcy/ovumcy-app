import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { Pressable, Text, View } from "react-native";

import type { PredictionMode } from "../../../models/profile";
import type {
  LoadedSettingsState,
  SettingsViewData,
} from "../../../services/settings-view-service";
import { AppButton } from "../../components/AppButton";
import { AppTextInput } from "../../components/AppTextInput";
import { BinaryToggleCard } from "../../components/BinaryToggleCard";
import { ChoiceGroup } from "../../components/ChoiceGroup";
import { FeatureCard } from "../../components/FeatureCard";
import { LabeledSliderField } from "../../components/LabeledSliderField";
import { StatusBanner } from "../../components/StatusBanner";
import type { SettingsFlowStyles } from "./settings-flow-styles";

type SettingsCycleSectionProps = {
  cycleDateInputValue: string;
  cycleErrorMessage: string;
  cycleGuidance: {
    adjusted: boolean;
    invalid: boolean;
    cycleLong: boolean;
    cycleShort: boolean;
    periodLong: boolean;
  };
  cyclePickerMaximumDate: Date | undefined;
  cyclePickerMinimumDate: Date | undefined;
  cyclePickerValue: Date;
  cycleStatusMessage: string;
  displayedCycleStartDate: string;
  now: Date;
  onAgeGroupSelect: (value: LoadedSettingsState["cycleValues"]["ageGroup"]) => void;
  onAutoPeriodFillChange: (value: boolean) => void;
  onClearLastPeriodStart: () => void;
  onCycleLengthChange: (value: number) => void;
  onCycleDateInputChange: (value: string) => void;
  onDatePickerCancel: () => void;
  onDatePickerChange: (event: DateTimePickerEvent, value: Date | undefined) => void;
  onDatePickerConfirm: () => void;
  onDatePickerToggle: () => void;
  onPredictionModeSelect: (value: PredictionMode) => void;
  onPeriodLengthChange: (value: number) => void;
  onUsageGoalSelect: (value: LoadedSettingsState["cycleValues"]["usageGoal"]) => void;
  predictionMode: PredictionMode;
  showDatePicker: boolean;
  state: LoadedSettingsState;
  styles: SettingsFlowStyles;
  supportsNativeDatePicker: boolean;
  viewData: SettingsViewData;
};

export function SettingsCycleSection({
  cycleDateInputValue,
  cycleErrorMessage,
  cycleGuidance,
  cyclePickerMaximumDate,
  cyclePickerMinimumDate,
  cyclePickerValue,
  cycleStatusMessage,
  displayedCycleStartDate,
  now,
  onAgeGroupSelect,
  onAutoPeriodFillChange,
  onClearLastPeriodStart,
  onCycleLengthChange,
  onCycleDateInputChange,
  onDatePickerCancel,
  onDatePickerChange,
  onDatePickerConfirm,
  onDatePickerToggle,
  onPredictionModeSelect,
  onPeriodLengthChange,
  onUsageGoalSelect,
  predictionMode,
  showDatePicker,
  state,
  styles,
  supportsNativeDatePicker,
  viewData,
}: SettingsCycleSectionProps) {
  const effectiveCycleErrorMessage = cycleGuidance.invalid
    ? viewData.cycle.messages.errorIncompatible
    : cycleErrorMessage;

  return (
    <FeatureCard testID="settings-cycle-section" title={viewData.cycle.title}>
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
              {state.cycleValues.lastPeriodStart
                ? displayedCycleStartDate
                : viewData.common.notSet}
            </Text>
            {state.cycleValues.lastPeriodStart ? (
              <View style={styles.dateActionRow}>
                <Pressable
                  accessibilityRole="button"
                  onPress={onClearLastPeriodStart}
                  style={styles.inlineAction}
                  testID="settings-cycle-clear-date-button"
                >
                  <Text style={styles.inlineActionText}>{viewData.common.clearDate}</Text>
                </Pressable>
              </View>
            ) : null}
          </Pressable>
        ) : (
          <>
            <View style={styles.dateFieldShell}>
              <Text
                style={[
                  styles.dateFieldValue,
                  !state.cycleValues.lastPeriodStart ? styles.dateFieldValueMuted : null,
                ]}
              >
                {state.cycleValues.lastPeriodStart
                  ? displayedCycleStartDate
                  : viewData.common.notSet}
              </Text>
              <View style={styles.dateActionRow}>
                <Pressable
                  accessibilityRole="button"
                  onPress={onDatePickerToggle}
                  style={styles.inlineAction}
                  testID="settings-cycle-date-field-button"
                >
                  <Text style={styles.inlineActionText}>{viewData.common.changeDate}</Text>
                </Pressable>
                {state.cycleValues.lastPeriodStart ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={onClearLastPeriodStart}
                    style={styles.inlineAction}
                    testID="settings-cycle-clear-date-button"
                  >
                    <Text style={styles.inlineActionText}>{viewData.common.clearDate}</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
            {showDatePicker ? (
              <View style={styles.formGroup}>
                <AppTextInput
                  autoCapitalize="none"
                  autoCorrect={false}
                  inputMode="numeric"
                  keyboardType="number-pad"
                  maxLength={10}
                  onChangeText={onCycleDateInputChange}
                  placeholder="YYYY-MM-DD"
                  style={styles.dateInput}
                  testID="settings-cycle-date-input"
                  value={cycleDateInputValue}
                />
                <View style={styles.actionsRow}>
                  <AppButton
                    label={viewData.common.cancelAction}
                    onPress={onDatePickerCancel}
                    testID="settings-cycle-date-cancel-button"
                    variant="secondary"
                  />
                  <AppButton
                    label={viewData.common.confirmAction}
                    onPress={onDatePickerConfirm}
                    testID="settings-cycle-date-confirm-button"
                  />
                </View>
              </View>
            ) : null}
          </>
        )}
        {supportsNativeDatePicker && showDatePicker ? (
          <DateTimePicker
            display="default"
            maximumDate={cyclePickerMaximumDate ?? now}
            minimumDate={cyclePickerMinimumDate ?? now}
            mode="date"
            onChange={onDatePickerChange}
            value={cyclePickerValue}
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
        {cycleGuidance.cycleLong ? (
          <Text style={styles.infoText}>{viewData.cycle.messages.infoCycleLong}</Text>
        ) : null}
        {cycleGuidance.cycleShort ? (
          <Text style={styles.infoText}>{viewData.cycle.messages.infoCycleShort}</Text>
        ) : null}
      </View>

      {effectiveCycleErrorMessage ? (
        <StatusBanner
          message={effectiveCycleErrorMessage}
          testID="settings-cycle-error-banner"
          tone="error"
        />
      ) : null}
      {cycleStatusMessage ? (
        <StatusBanner
          message={cycleStatusMessage}
          testID="settings-cycle-status-banner"
          tone="success"
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

      <View style={styles.formGroup}>
        <Text style={styles.fieldLabel}>{viewData.cycle.predictionModeLabel}</Text>
        <Text style={styles.helperText}>{viewData.cycle.predictionModeHint}</Text>
        <ChoiceGroup
          onSelect={onPredictionModeSelect}
          options={viewData.cycle.predictionModeOptions}
          selectedValue={predictionMode}
          testIDPrefix="settings-prediction-mode"
        />
      </View>

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
    </FeatureCard>
  );
}
