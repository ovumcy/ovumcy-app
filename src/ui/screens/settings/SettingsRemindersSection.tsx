import { Text, View } from "react-native";

import {
  MAX_REMINDER_LEAD_DAYS,
  MIN_REMINDER_LEAD_DAYS,
} from "../../../models/profile";
import type {
  LoadedSettingsState,
  SettingsViewData,
} from "../../../services/settings-view-service";
import { AppTextInput } from "../../components/AppTextInput";
import { BinaryToggleCard } from "../../components/BinaryToggleCard";
import { FeatureCard } from "../../components/FeatureCard";
import { LabeledSliderField } from "../../components/LabeledSliderField";
import { StatusBanner } from "../../components/StatusBanner";
import type { SettingsFlowStyles } from "./settings-flow-styles";

type SettingsRemindersSectionProps = {
  onDailyLogReminderChange: (value: boolean) => void;
  onFertileWindowReminderChange: (value: boolean) => void;
  onReminderLeadDaysChange: (value: number) => void;
  onReminderTimeChange: (value: string) => void;
  onUpcomingPeriodReminderChange: (value: boolean) => void;
  reminderStatusMessage: string;
  reminderStatusTone: "success" | "error" | "info";
  state: LoadedSettingsState;
  styles: SettingsFlowStyles;
  viewData: SettingsViewData;
};

// Local device reminders are a Free-tier surface (web parity): every control
// below works with no account and no plan. Reminders are delivered on this
// device only — there is no server-side reminder channel to opt into, and no
// plan to buy, so this section carries no premium affordance at all.
export function SettingsRemindersSection({
  onDailyLogReminderChange,
  onFertileWindowReminderChange,
  onReminderLeadDaysChange,
  onReminderTimeChange,
  onUpcomingPeriodReminderChange,
  reminderStatusMessage,
  reminderStatusTone,
  state,
  styles,
  viewData,
}: SettingsRemindersSectionProps) {
  const reminderView = viewData.reminders;

  return (
    <FeatureCard
      description={reminderView.subtitle}
      testID="settings-reminders-section"
      title={reminderView.title}
    >
      <Text style={styles.helperText}>{reminderView.localOnlyHint}</Text>

      <BinaryToggleCard
        description={reminderView.dailyLog.hint}
        descriptionPosition="below"
        icon="📝"
        label={reminderView.dailyLog.label}
        onValueChange={onDailyLogReminderChange}
        stateText={
          state.reminderValues.dailyLogReminderEnabled
            ? reminderView.dailyLog.stateOn
            : reminderView.dailyLog.stateOff
        }
        testID="settings-toggle-reminder-daily-log"
        value={state.reminderValues.dailyLogReminderEnabled}
      />

      <BinaryToggleCard
        description={reminderView.upcomingPeriod.hint}
        descriptionPosition="below"
        icon="🩸"
        label={reminderView.upcomingPeriod.label}
        onValueChange={onUpcomingPeriodReminderChange}
        stateText={
          state.reminderValues.upcomingPeriodReminderEnabled
            ? reminderView.upcomingPeriod.stateOn
            : reminderView.upcomingPeriod.stateOff
        }
        testID="settings-toggle-reminder-upcoming-period"
        value={state.reminderValues.upcomingPeriodReminderEnabled}
      />

      <BinaryToggleCard
        description={reminderView.fertileWindow.hint}
        descriptionPosition="below"
        icon="🌿"
        label={reminderView.fertileWindow.label}
        onValueChange={onFertileWindowReminderChange}
        stateText={
          state.reminderValues.fertileWindowReminderEnabled
            ? reminderView.fertileWindow.stateOn
            : reminderView.fertileWindow.stateOff
        }
        testID="settings-toggle-reminder-fertile-window"
        value={state.reminderValues.fertileWindowReminderEnabled}
      />

      <View style={styles.formGroup}>
        <Text style={styles.fieldLabel}>{reminderView.timeLabel}</Text>
        <Text style={styles.helperText}>{reminderView.timeHint}</Text>
        <AppTextInput
          accessibilityLabel={reminderView.timeLabel}
          autoCapitalize="none"
          autoCorrect={false}
          inputMode="numeric"
          keyboardType="numbers-and-punctuation"
          maxLength={5}
          onChangeText={onReminderTimeChange}
          placeholder="20:00"
          style={styles.dateInput}
          testID="settings-reminder-time-input"
          value={state.reminderValues.reminderTime}
        />
      </View>

      <LabeledSliderField
        hint={reminderView.leadDaysHint}
        label={reminderView.leadDaysLabel}
        maximumValue={MAX_REMINDER_LEAD_DAYS}
        minimumValue={MIN_REMINDER_LEAD_DAYS}
        onValueChange={(value) => onReminderLeadDaysChange(Math.round(value))}
        testID="settings-reminder-lead-days-slider"
        value={state.reminderValues.reminderLeadDays}
        valueSuffix={` ${viewData.common.daysShort}`}
      />

      {reminderStatusMessage ? (
        <StatusBanner
          message={reminderStatusMessage}
          testID="settings-reminders-status-banner"
          tone={reminderStatusTone}
        />
      ) : null}
    </FeatureCard>
  );
}
