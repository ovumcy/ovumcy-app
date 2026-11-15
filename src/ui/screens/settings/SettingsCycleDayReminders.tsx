import { useState } from "react";
import { Text, View } from "react-native";

import {
  CYCLE_DAY_REMINDER_LABEL_MAX_LENGTH,
  CYCLE_DAY_REMINDER_MAX_DAY,
  CYCLE_DAY_REMINDER_MAX_RULES,
  CYCLE_DAY_REMINDER_MIN_DAY,
  type CycleDayReminder,
} from "../../../models/profile";
import {
  addCycleDayReminderRule,
  patchCycleDayReminderRule,
  removeCycleDayReminderRule,
} from "../../../services/cycle-day-reminder-policy";
import type { SettingsViewData } from "../../../services/settings-view-service";
import { AppButton } from "../../components/AppButton";
import { AppTextInput } from "../../components/AppTextInput";
import { BinaryToggleCard } from "../../components/BinaryToggleCard";
import type { SettingsFlowStyles } from "./settings-flow-styles";

type SettingsCycleDayRemindersProps = {
  onChange: (rules: CycleDayReminder[]) => void;
  rules: readonly CycleDayReminder[];
  styles: SettingsFlowStyles;
  view: SettingsViewData["reminders"]["cycleDay"];
};

type RuleNumberFieldProps = {
  accessibilityLabel: string;
  max: number;
  min: number;
  onCommit: (value: number) => void;
  style: SettingsFlowStyles["dateInput"];
  testID: string;
  value: number;
};

// The field keeps its own text so it can be emptied and retyped; only an
// in-range number reaches the draft, and leaving the field shows the draft
// value again.
function RuleNumberField({
  accessibilityLabel,
  max,
  min,
  onCommit,
  style,
  testID,
  value,
}: RuleNumberFieldProps) {
  const [draft, setDraft] = useState<string | null>(null);

  return (
    <AppTextInput
      accessibilityLabel={accessibilityLabel}
      inputMode="numeric"
      keyboardType="number-pad"
      maxLength={2}
      onBlur={() => setDraft(null)}
      onChangeText={(next) => {
        const digits = next.replace(/[^0-9]/g, "");
        setDraft(digits);
        const parsed = Number(digits);
        if (digits !== "" && parsed >= min && parsed <= max) {
          onCommit(parsed);
        }
      }}
      onFocus={() => setDraft(String(value))}
      style={style}
      testID={testID}
      value={draft ?? String(value)}
    />
  );
}

// Owner-defined "day N of the running cycle" reminders. Edits only change the
// draft list; the section's existing save action persists and reschedules.
export function SettingsCycleDayReminders({
  onChange,
  rules,
  styles,
  view,
}: SettingsCycleDayRemindersProps) {
  const limitReached = rules.length >= CYCLE_DAY_REMINDER_MAX_RULES;

  return (
    <View style={styles.formGroup} testID="settings-cycle-day-reminders">
      <Text style={styles.fieldLabel}>{view.title}</Text>
      <Text style={styles.helperText}>{view.hint}</Text>

      {rules.length === 0 ? (
        <Text style={styles.helperText} testID="settings-cycle-day-reminders-empty">
          {view.empty}
        </Text>
      ) : null}

      {rules.map((rule, index) => {
        const heading = `${view.ruleHeading} ${index + 1}`;
        return (
          <View
            key={rule.id}
            style={styles.formGroup}
            testID={`settings-cycle-day-rule-${index}`}
          >
            <Text style={styles.fieldLabel}>{heading}</Text>

            <Text style={styles.helperText}>{view.dayLabel}</Text>
            <RuleNumberField
              accessibilityLabel={`${heading}: ${view.dayLabel}`}
              max={CYCLE_DAY_REMINDER_MAX_DAY}
              min={CYCLE_DAY_REMINDER_MIN_DAY}
              onCommit={(cycleDay) =>
                onChange(patchCycleDayReminderRule(rules, rule.id, { cycleDay }))
              }
              style={styles.dateInput}
              testID={`settings-cycle-day-rule-${index}-day`}
              value={rule.cycleDay}
            />

            <Text style={styles.helperText}>{view.hourLabel}</Text>
            <RuleNumberField
              accessibilityLabel={`${heading}: ${view.hourLabel}`}
              max={23}
              min={0}
              onCommit={(remindAtHour) =>
                onChange(patchCycleDayReminderRule(rules, rule.id, { remindAtHour }))
              }
              style={styles.dateInput}
              testID={`settings-cycle-day-rule-${index}-hour`}
              value={rule.remindAtHour}
            />

            <Text style={styles.helperText}>{view.labelLabel}</Text>
            <Text style={styles.helperText}>{view.labelHint}</Text>
            <AppTextInput
              accessibilityLabel={`${heading}: ${view.labelLabel}`}
              autoCorrect={false}
              maxLength={CYCLE_DAY_REMINDER_LABEL_MAX_LENGTH}
              onChangeText={(value) =>
                onChange(patchCycleDayReminderRule(rules, rule.id, { label: value }))
              }
              style={styles.dateInput}
              testID={`settings-cycle-day-rule-${index}-label`}
              value={rule.label}
            />

            {/* Without a label there is nothing to show, so the opt-in appears
                only once one is typed. */}
            {rule.label.trim() !== "" ? (
              <BinaryToggleCard
                description={view.showLabelHint}
                descriptionPosition="below"
                icon="🔔"
                label={view.showLabel}
                onValueChange={(value) =>
                  onChange(patchCycleDayReminderRule(rules, rule.id, { showLabel: value }))
                }
                stateText={rule.showLabel ? view.stateOn : view.stateOff}
                testID={`settings-cycle-day-rule-${index}-show-label`}
                value={rule.showLabel}
              />
            ) : null}

            <AppButton
              label={`${view.delete} (${heading})`}
              onPress={() => onChange(removeCycleDayReminderRule(rules, rule.id))}
              testID={`settings-cycle-day-rule-${index}-delete`}
              variant="danger_secondary"
            />
          </View>
        );
      })}

      {limitReached ? (
        <Text style={styles.helperText} testID="settings-cycle-day-reminders-limit">
          {view.limitReached}
        </Text>
      ) : (
        <AppButton
          label={view.add}
          onPress={() => onChange(addCycleDayReminderRule(rules))}
          testID="settings-cycle-day-reminders-add"
          variant="secondary"
        />
      )}
    </View>
  );
}
