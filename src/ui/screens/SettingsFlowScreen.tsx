import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

import type {
  LoadedSettingsState,
  SettingsViewData,
} from "../../services/settings-view-service";
import { parseLocalDate } from "../../services/profile-settings-policy";
import { AppButton } from "../components/AppButton";
import { BinaryToggleCard } from "../components/BinaryToggleCard";
import { ChoiceGroup } from "../components/ChoiceGroup";
import { FeatureCard } from "../components/FeatureCard";
import { LabeledSliderField } from "../components/LabeledSliderField";
import { ScreenScaffold } from "../components/ScreenScaffold";
import { colors, spacing } from "../theme/tokens";

type SettingsFlowScreenProps = {
  cycleGuidance: {
    adjusted: boolean;
    periodLong: boolean;
    cycleShort: boolean;
  };
  cycleStatusMessage: string;
  cycleErrorMessage: string;
  isSavingCycle: boolean;
  isSavingTracking: boolean;
  now: Date;
  onAgeGroupSelect: (value: LoadedSettingsState["cycleValues"]["ageGroup"]) => void;
  onAutoPeriodFillChange: (value: boolean) => void;
  onClearLastPeriodStart: () => void;
  onCycleLengthChange: (value: number) => void;
  onDatePickerChange: (event: DateTimePickerEvent, value: Date | undefined) => void;
  onDatePickerToggle: () => void;
  onIrregularCycleChange: (value: boolean) => void;
  onSaveCycleSettings: () => void | Promise<void>;
  onSaveTrackingSettings: () => void | Promise<void>;
  onTemperatureUnitSelect: (value: LoadedSettingsState["trackingValues"]["temperatureUnit"]) => void;
  onTrackBBTChange: (value: boolean) => void;
  onTrackCervicalMucusChange: (value: boolean) => void;
  onHideSexChipChange: (value: boolean) => void;
  onPeriodLengthChange: (value: number) => void;
  onUnpredictableCycleChange: (value: boolean) => void;
  onUsageGoalSelect: (value: LoadedSettingsState["cycleValues"]["usageGoal"]) => void;
  showDatePicker: boolean;
  state: LoadedSettingsState;
  trackingStatusMessage: string;
  viewData: SettingsViewData;
};

export function SettingsFlowScreen({
  cycleGuidance,
  cycleStatusMessage,
  cycleErrorMessage,
  isSavingCycle,
  isSavingTracking,
  now,
  onAgeGroupSelect,
  onAutoPeriodFillChange,
  onClearLastPeriodStart,
  onCycleLengthChange,
  onDatePickerChange,
  onDatePickerToggle,
  onHideSexChipChange,
  onIrregularCycleChange,
  onPeriodLengthChange,
  onSaveCycleSettings,
  onSaveTrackingSettings,
  onTemperatureUnitSelect,
  onTrackBBTChange,
  onTrackCervicalMucusChange,
  onUnpredictableCycleChange,
  onUsageGoalSelect,
  showDatePicker,
  state,
  trackingStatusMessage,
  viewData,
}: SettingsFlowScreenProps) {
  const selectedDate = state.cycleValues.lastPeriodStart
    ? parseLocalDate(state.cycleValues.lastPeriodStart)
    : null;
  const supportsNativeDatePicker = Platform.OS !== "web";
  const displayedDate = selectedDate
    ? formatLongDate(selectedDate)
    : viewData.common.changeDate;

  return (
    <ScreenScaffold
      eyebrow={viewData.eyebrow}
      title={viewData.title}
      description={viewData.description}
    >
      <FeatureCard
        title={viewData.cycle.title}
        description={viewData.cycle.lastPeriodStartHint}
      >
        <LabeledSliderField
          hint=""
          label={viewData.cycle.cycleLengthLabel}
          maximumValue={90}
          minimumValue={15}
          onValueChange={(value) => onCycleLengthChange(Math.round(value))}
          testID="settings-cycle-length-slider"
          value={state.cycleValues.cycleLength}
          valueSuffix={` ${viewData.common.daysShort}`}
        />

        <LabeledSliderField
          hint=""
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
          {cycleErrorMessage ? (
            <Text style={styles.errorText}>{cycleErrorMessage}</Text>
          ) : null}
          {cycleStatusMessage ? (
            <Text style={styles.successText}>{cycleStatusMessage}</Text>
          ) : null}
        </View>

        <BinaryToggleCard
          description={viewData.cycle.autoPeriodFillHint}
          icon="🩸"
          label={viewData.cycle.autoPeriodFillLabel}
          onValueChange={onAutoPeriodFillChange}
          testID="settings-toggle-auto-period-fill"
          value={state.cycleValues.autoPeriodFill}
        />

        <BinaryToggleCard
          description={viewData.cycle.irregularCycleHint}
          icon="〰️"
          label={viewData.cycle.irregularCycleLabel}
          onValueChange={onIrregularCycleChange}
          testID="settings-toggle-irregular-cycle"
          value={state.cycleValues.irregularCycle}
        />

        <BinaryToggleCard
          description={viewData.cycle.unpredictableCycleHint}
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
            compact
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

      <FeatureCard
        title={viewData.tracking.title}
        description={viewData.tracking.subtitle}
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
            compact
            onSelect={onTemperatureUnitSelect}
            options={viewData.tracking.temperatureUnit.options}
            selectedValue={state.trackingValues.temperatureUnit}
            testIDPrefix="settings-temperature-unit"
          />
        </View>

        {trackingStatusMessage ? (
          <Text style={styles.successText}>{trackingStatusMessage}</Text>
        ) : null}

        <AppButton
          disabled={isSavingTracking}
          label={viewData.tracking.saveLabel}
          onPress={onSaveTrackingSettings}
          testID="settings-save-tracking-button"
          variant="secondary"
        />
      </FeatureCard>
    </ScreenScaffold>
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
    borderRadius: 18,
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
  errorText: {
    color: "#b42318",
    fontSize: 14,
    lineHeight: 21,
  },
  successText: {
    color: colors.accentStrong,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "600",
  },
});
