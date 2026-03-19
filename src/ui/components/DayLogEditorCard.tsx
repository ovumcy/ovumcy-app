import { useEffect, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type LayoutChangeEvent,
} from "react-native";

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
  cancelLabel?: string;
  entryExists: boolean;
  isSaving: boolean;
  onSectionLayout?: (
    key: DayLogEditorSectionKey,
    y: number,
  ) => void;
  variant?: "dashboard" | "calendar";
  record: DayLogRecord;
  statusMessage: string;
  statusTone?: "success" | "error" | undefined;
  viewData: DayLogEditorViewData;
  onCancel?: () => void;
  onDelete?: () => void | Promise<void>;
  onPatch: (updates: Partial<DayLogRecord>) => void;
  onSave: () => void | Promise<void>;
};

export type DayLogEditorSectionKey =
  | "period"
  | "symptoms"
  | "mood"
  | "cycleFactors"
  | "flow"
  | "intimacy"
  | "bbt"
  | "cervicalMucus"
  | "notes";

export function DayLogEditorCard({
  cancelLabel,
  entryExists,
  isSaving,
  onSectionLayout,
  variant = "dashboard",
  record,
  statusMessage,
  statusTone = "success",
  viewData,
  onCancel,
  onDelete,
  onPatch,
  onSave,
}: DayLogEditorCardProps) {
  const showsCalendarOrder = variant === "calendar";
  const [isNotesOpen, setIsNotesOpen] = useState(record.notes.trim().length > 0);
  const headerDescription = [viewData.subtitle, viewData.dateLabel]
    .filter((value) => value.trim().length > 0)
    .join(" ");

  useEffect(() => {
    if (record.notes.trim().length > 0) {
      setIsNotesOpen(true);
    }
  }, [record.notes]);

  function handleSectionLayout(key: DayLogEditorSectionKey) {
    return (event: LayoutChangeEvent) => {
      onSectionLayout?.(key, event.nativeEvent.layout.y);
    };
  }

  return (
    <FeatureCard
      title={viewData.title}
      description={headerDescription}
    >
      <View onLayout={handleSectionLayout("period")}>
        <BinaryToggleCard
          icon="🩸"
          label={viewData.labels.periodDay}
          onValueChange={(value) => onPatch({ isPeriod: value })}
          testID="day-log-period-toggle"
          value={record.isPeriod}
        />
      </View>

      <View onLayout={handleSectionLayout("symptoms")} style={styles.section}>
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

      <View onLayout={handleSectionLayout("mood")} style={styles.section}>
        <Text style={styles.sectionLabel}>{viewData.labels.mood}</Text>
        <ChoiceGroup
          compact
          onSelect={(value) => onPatch({ mood: value })}
          options={viewData.options.mood}
          selectedValue={record.mood}
          testIDPrefix="day-log-mood"
        />
      </View>

      <View onLayout={handleSectionLayout("cycleFactors")} style={styles.section}>
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

      {record.isPeriod ? (
        <View onLayout={handleSectionLayout("flow")} style={styles.section}>
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

      <View onLayout={handleSectionLayout("intimacy")} style={styles.section}>
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

      {showsCalendarOrder ? (
        <>
          {viewData.visibility.showBBT ? (
            <View onLayout={handleSectionLayout("bbt")} style={styles.section}>
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

          {viewData.visibility.showCervicalMucus ? (
            <View onLayout={handleSectionLayout("cervicalMucus")} style={styles.section}>
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
        </>
      ) : (
        <>
          {viewData.visibility.showCervicalMucus ? (
            <View onLayout={handleSectionLayout("cervicalMucus")} style={styles.section}>
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
            <View onLayout={handleSectionLayout("bbt")} style={styles.section}>
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
        </>
      )}

      <View onLayout={handleSectionLayout("notes")} style={styles.section}>
        <Pressable
          onPress={() => setIsNotesOpen((current) => !current)}
          style={styles.notesToggle}
          testID="day-log-notes-toggle"
        >
          <Text style={styles.notesToggleText}>
            {record.notes.trim().length > 0
              ? isNotesOpen
                ? viewData.labels.hideNote
                : viewData.labels.editNote
              : viewData.labels.addNote}
          </Text>
        </Pressable>

        {isNotesOpen ? (
          <View style={styles.notesSection}>
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
        ) : null}
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
        {onCancel ? (
          <AppButton
            disabled={isSaving}
            label={cancelLabel ?? "Cancel"}
            onPress={onCancel}
            testID="day-log-cancel-button"
            variant="secondary"
          />
        ) : null}
      </View>

      {statusMessage ? (
        <StatusBanner message={statusMessage} tone={statusTone} testID="day-log-status-banner" />
      ) : null}

      {onDelete && entryExists ? (
        <View style={styles.dangerSection}>
          <AppButton
            disabled={isSaving}
            label={viewData.actions.deleteLabel}
            onPress={onDelete}
            testID="day-log-delete-button"
            variant="danger"
          />
          <Text style={styles.deleteHint}>{viewData.labels.deleteHint}</Text>
        </View>
      ) : null}
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
  notesToggle: {
    alignSelf: "flex-start",
  },
  notesToggleText: {
    color: colors.accentStrong,
    fontSize: 13,
    fontWeight: "700",
  },
  notesSection: {
    gap: spacing.sm,
  },
  deleteHint: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  dangerSection: {
    gap: spacing.xs,
  },
});
