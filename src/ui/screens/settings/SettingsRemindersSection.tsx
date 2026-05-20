import { Text, View } from "react-native";

import type {
  LoadedSettingsState,
  SettingsViewData,
} from "../../../services/settings-view-service";
import { AppTextInput } from "../../components/AppTextInput";
import { BinaryToggleCard } from "../../components/BinaryToggleCard";
import { FeatureCard } from "../../components/FeatureCard";
import { PremiumLockCard } from "../../components/PremiumLockCard";
import { StatusBanner } from "../../components/StatusBanner";
import type { SettingsFlowStyles } from "./settings-flow-styles";

type SettingsRemindersSectionProps = {
  onDailyLogReminderChange: (value: boolean) => void;
  onFertileWindowReminderChange: (value: boolean) => void;
  onManagedReminderEmailsChange: (value: boolean) => void;
  onPremiumCTAPress?: (() => void) | undefined;
  onReminderTimeChange: (value: string) => void;
  onUpcomingPeriodReminderChange: (value: boolean) => void;
  reminderStatusMessage: string;
  reminderStatusTone: "success" | "error" | "info";
  state: LoadedSettingsState;
  styles: SettingsFlowStyles;
  viewData: SettingsViewData;
};

export function SettingsRemindersSection({
  onDailyLogReminderChange,
  onFertileWindowReminderChange,
  onManagedReminderEmailsChange,
  onPremiumCTAPress,
  onReminderTimeChange,
  onUpcomingPeriodReminderChange,
  reminderStatusMessage,
  reminderStatusTone,
  state,
  styles,
  viewData,
}: SettingsRemindersSectionProps) {
  const reminderView = viewData.reminders;
  const premiumLockCopy = viewData.premiumLock;

  return (
    <FeatureCard
      description={reminderView.subtitle}
      testID="settings-reminders-section"
      title={reminderView.title}
    >
      <Text style={styles.helperText}>{reminderView.localOnlyHint}</Text>
      <Text style={styles.helperText}>{reminderView.emailHint}</Text>

      {!state.managedPremiumAccess.reminders ? (
        <PremiumLockCard
          ctaLabel={premiumLockCopy.ctaLabel}
          description={reminderView.lockedHint}
          eyebrowLabel={premiumLockCopy.eyebrowLabel}
          onPress={onPremiumCTAPress}
          testID="settings-reminders-lock"
          title={premiumLockCopy.remindersTitle}
        />
      ) : null}

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

      <BinaryToggleCard
        description={reminderView.emailDelivery.hint}
        descriptionPosition="below"
        icon="✉️"
        label={reminderView.emailDelivery.label}
        onValueChange={onManagedReminderEmailsChange}
        stateText={
          state.reminderValues.managedReminderEmailsEnabled
            ? reminderView.emailDelivery.stateOn
            : reminderView.emailDelivery.stateOff
        }
        testID="settings-toggle-reminder-email-delivery"
        value={state.reminderValues.managedReminderEmailsEnabled}
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
