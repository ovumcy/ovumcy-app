import { StyleSheet, Text, TextInput, View } from "react-native";

import type { DayLogRecord } from "../../models/day-log";
import type { DayLogEditorViewData } from "../../services/day-log-editor-service";
import { AppButton } from "./AppButton";
import { BinaryToggleCard } from "./BinaryToggleCard";
import { ChoiceGroup } from "./ChoiceGroup";
import { FeatureCard } from "./FeatureCard";
import { MultiSelectChipGroup } from "./MultiSelectChipGroup";
import { StatusBanner } from "./StatusBanner";
import { colors, spacing } from "../theme/tokens";

type DayLogEditorCardProps = {
  entryExists: boolean;
  isSaving: boolean;
  record: DayLogRecord;
  statusMessage: string;
  statusTone?: "success" | "error" | undefined;
  viewData: DayLogEditorViewData;
  onDelete?: () => void | Promise<void>;
  onPatch: (updates: Partial<DayLogRecord>) => void;
  onSave: () => void | Promise<void>;
};

export function DayLogEditorCard({
  entryExists,
  isSaving,
  record,
  statusMessage,
  statusTone = "success",
  viewData,
  onDelete,
  onPatch,
  onSave,
}: DayLogEditorCardProps) {
  return (
    <FeatureCard
      title={viewData.title}
      description={`${viewData.subtitle} ${viewData.dateLabel}`}
    >
      <BinaryToggleCard
        icon="🩸"
        label={viewData.labels.periodDay}
        onValueChange={(value) => onPatch({ isPeriod: value })}
        testID="day-log-period-toggle"
        value={record.isPeriod}
      />

      {record.isPeriod ? (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{viewData.labels.flow}</Text>
          <ChoiceGroup
            compact
            onSelect={(value) => onPatch({ flow: value })}
            options={viewData.options.flow}
            selectedValue={record.flow}
            testIDPrefix="day-log-flow"
          />
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>{viewData.labels.symptoms}</Text>
        <MultiSelectChipGroup
          compact
          onToggle={(value) => {
            const next = record.symptomIDs.includes(value)
              ? record.symptomIDs.filter((current) => current !== value)
              : [...record.symptomIDs, value];
            onPatch({ symptomIDs: next });
          }}
          options={viewData.options.symptoms}
          selectedValues={record.symptomIDs}
          testIDPrefix="day-log-symptom"
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>{viewData.labels.mood}</Text>
        <ChoiceGroup
          compact
          onSelect={(value) => onPatch({ mood: value })}
          options={viewData.options.mood}
          selectedValue={record.mood}
          testIDPrefix="day-log-mood"
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>{viewData.labels.cycleFactors}</Text>
        <Text style={styles.sectionHint}>{viewData.labels.cycleFactorsHint}</Text>
        <MultiSelectChipGroup
          compact
          onToggle={(value) => {
            const next = record.cycleFactorKeys.includes(value)
              ? record.cycleFactorKeys.filter((current) => current !== value)
              : [...record.cycleFactorKeys, value];
            onPatch({ cycleFactorKeys: next });
          }}
          options={viewData.options.cycleFactors}
          selectedValues={record.cycleFactorKeys}
          testIDPrefix="day-log-factor"
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>{viewData.labels.intimacy}</Text>
        {viewData.visibility.showSexActivity ? (
          <>
            <Text style={styles.sectionHint}>
              {viewData.labels.intimacyVisibleHint}
            </Text>
            <ChoiceGroup
              compact
              onSelect={(value) => onPatch({ sexActivity: value })}
              options={viewData.options.sexActivity}
              selectedValue={record.sexActivity}
              testIDPrefix="day-log-sex"
            />
          </>
        ) : (
          <Text style={styles.sectionHint}>{viewData.labels.intimacyHiddenHint}</Text>
        )}
      </View>

      {viewData.visibility.showCervicalMucus ? (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{viewData.labels.cervicalMucus}</Text>
          <Text style={styles.sectionHint}>
            {viewData.labels.cervicalMucusExplainer}
          </Text>
          <ChoiceGroup
            compact
            onSelect={(value) => onPatch({ cervicalMucus: value })}
            options={viewData.options.cervicalMucus}
            selectedValue={record.cervicalMucus}
            testIDPrefix="day-log-cervical"
          />
        </View>
      ) : null}

      {viewData.visibility.showBBT ? (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{viewData.labels.bbt}</Text>
          <Text style={styles.sectionHint}>{viewData.labels.bbtHint}</Text>
          <TextInput
            inputMode="decimal"
            onChangeText={(value) => {
              const normalized = value.replace(",", ".").trim();
              onPatch({
                bbt: normalized === "" ? 0 : Number(normalized),
              });
            }}
            placeholder="0.00"
            style={styles.input}
            testID="day-log-bbt-input"
            value={record.bbt > 0 ? record.bbt.toFixed(2) : ""}
          />
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>{viewData.labels.notes}</Text>
        <TextInput
          multiline
          onChangeText={(value) => onPatch({ notes: value })}
          placeholder={viewData.labels.notesPlaceholder}
          style={[styles.input, styles.notesInput]}
          testID="day-log-notes-input"
          value={record.notes}
        />
      </View>

      <View style={styles.actions}>
        <AppButton
          disabled={isSaving}
          label={
            isSaving
              ? "Saving..."
              : entryExists
                ? viewData.actions.updateLabel
                : viewData.actions.saveLabel
          }
          onPress={onSave}
          testID="day-log-save-button"
        />
        {onDelete ? (
          <AppButton
            disabled={isSaving}
            label={viewData.actions.deleteLabel}
            onPress={onDelete}
            testID="day-log-delete-button"
            variant="secondary"
          />
        ) : null}
      </View>

      {statusMessage ? (
        <StatusBanner message={statusMessage} tone={statusTone} testID="day-log-status-banner" />
      ) : null}
      {onDelete ? <Text style={styles.deleteHint}>{viewData.labels.deleteHint}</Text> : null}
    </FeatureCard>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.sm,
  },
  sectionLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  sectionHint: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    color: colors.text,
    fontSize: 15,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  notesInput: {
    minHeight: 112,
    textAlignVertical: "top",
  },
  actions: {
    gap: spacing.sm,
  },
  deleteHint: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
});
