import { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from "react-native";

import type { DayLogRecord } from "../../models/day-log";
import type { DayLogEditorViewData } from "../../services/day-log-editor-service";
import {
  formatTemperatureValue,
  roundTemperature,
  unitToCelsius,
} from "../../services/temperature-policy";
import { AppButton } from "./AppButton";
import { AppTextInput } from "./AppTextInput";
import { BinaryToggleCard } from "./BinaryToggleCard";
import { ChoiceGroup } from "./ChoiceGroup";
import { FeatureCard } from "./FeatureCard";
import { MultiSelectChipGroup } from "./MultiSelectChipGroup";
import { StatusBanner } from "./StatusBanner";
import type { AppThemeColors } from "../theme/tokens";
import { spacing } from "../theme/tokens";
import { useThemedStyles } from "../theme/useThemedStyles";

type DayLogEditorCardProps = {
  cancelLabel?: string;
  entryExists: boolean;
  highlightedSection?: DayLogEditorSectionKey | null;
  isSaving: boolean;
  onSectionLayout?: (
    key: DayLogEditorSectionKey,
    y: number,
  ) => void;
  variant?: "dashboard" | "calendar";
  record: DayLogRecord;
  statusMessage: string;
  statusTone?: "error" | "info" | "success" | undefined;
  viewData: DayLogEditorViewData;
  onCancel?: () => void;
  onDelete?: () => void | Promise<void>;
  onPatch: (updates: Partial<DayLogRecord>) => void;
  onSave: () => void | Promise<void>;
  showsSaveAction?: boolean;
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
  | "lhTest"
  | "pregnancyTest"
  | "notes";

export function DayLogEditorCard({
  cancelLabel,
  entryExists,
  highlightedSection = null,
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
  showsSaveAction = true,
}: DayLogEditorCardProps) {
  const styles = useThemedStyles(createStyles);
  const showsCalendarOrder = variant === "calendar";
  const [showsAllSymptoms, setShowsAllSymptoms] = useState(false);
  const headerDescription = [viewData.subtitle, viewData.dateLabel]
    .filter((value) => value.trim().length > 0)
    .join(" ");
  const collapsedSymptomsState = useMemo(
    () =>
      buildCollapsedSymptomOptions(
        viewData.options.symptoms,
        record.symptomIDs,
      ),
    [record.symptomIDs, viewData.options.symptoms],
  );
  const symptomOptions = showsAllSymptoms
    ? viewData.options.symptoms
    : collapsedSymptomsState.options;

  useEffect(() => {
    if (collapsedSymptomsState.hiddenCount === 0 && showsAllSymptoms) {
      setShowsAllSymptoms(false);
    }
  }, [collapsedSymptomsState.hiddenCount, showsAllSymptoms]);

  const temperatureUnit = viewData.temperatureUnit;
  const [bbtKey, setBbtKey] = useState(`${record.date}:${temperatureUnit}`);
  const [bbtText, setBbtText] = useState(() =>
    formatTemperatureValue(record.bbt, temperatureUnit),
  );
  const nextBbtKey = `${record.date}:${temperatureUnit}`;
  if (nextBbtKey !== bbtKey) {
    // Reset the editable text when the day or the unit changes, without
    // reformatting live keystrokes within the same day (React's "adjust state
    // during render" pattern — no effect needed).
    setBbtKey(nextBbtKey);
    setBbtText(formatTemperatureValue(record.bbt, temperatureUnit));
  }

  function handleBbtChange(value: string) {
    const sanitized = sanitizeBbtInput(value);
    setBbtText(sanitized);
    const displayValue = Number(sanitized);
    const celsius =
      Number.isFinite(displayValue) && displayValue > 0
        ? roundTemperature(unitToCelsius(displayValue, temperatureUnit))
        : 0;
    onPatch({ bbt: celsius });
  }

  function handleSectionLayout(key: DayLogEditorSectionKey) {
    return (event: LayoutChangeEvent) => {
      onSectionLayout?.(key, event.nativeEvent.layout.y);
    };
  }

  function resolveSectionStyle(key: DayLogEditorSectionKey, baseStyle?: object) {
    return [baseStyle ?? null, highlightedSection === key ? styles.sectionHighlighted : null];
  }

  // These four sections render in both layouts; only their order differs
  // (calendar puts BBT first, dashboard puts it last). Define each once.
  const bbtSection = viewData.visibility.showBBT ? (
    <View
      onLayout={handleSectionLayout("bbt")}
      style={resolveSectionStyle("bbt", styles.section)}
    >
      <Text style={styles.sectionLabel}>{viewData.labels.bbt}</Text>
      <Text style={styles.sectionHint}>{viewData.labels.bbtHint}</Text>
      <AppTextInput
        inputMode="decimal"
        maxLength={6}
        onBlur={() => setBbtText(formatTemperatureValue(record.bbt, temperatureUnit))}
        onChangeText={handleBbtChange}
        placeholder="0.00"
        style={styles.input}
        testID="day-log-bbt-input"
        value={bbtText}
      />
    </View>
  ) : null;

  const cervicalMucusSection = viewData.visibility.showCervicalMucus ? (
    <View
      onLayout={handleSectionLayout("cervicalMucus")}
      style={resolveSectionStyle("cervicalMucus", styles.section)}
    >
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
  ) : null;

  const lhTestSection = viewData.visibility.showLHTest ? (
    <View
      onLayout={handleSectionLayout("lhTest")}
      style={resolveSectionStyle("lhTest", styles.section)}
    >
      <Text style={styles.sectionLabel}>{viewData.labels.lhTest}</Text>
      <Text style={styles.sectionHint}>{viewData.labels.lhTestHint}</Text>
      <ChoiceGroup
        compact
        onSelect={(value) => onPatch({ lhTest: value })}
        options={viewData.options.lhTest}
        selectedValue={record.lhTest}
        testIDPrefix="day-log-lh"
      />
    </View>
  ) : null;

  const pregnancyTestSection = (
    <View
      onLayout={handleSectionLayout("pregnancyTest")}
      style={resolveSectionStyle("pregnancyTest", styles.section)}
    >
      <Text style={styles.sectionLabel}>
        {viewData.labels.pregnancyTest}
      </Text>
      <Text style={styles.sectionHint}>
        {viewData.labels.pregnancyTestHint}
      </Text>
      <ChoiceGroup
        compact
        onSelect={(value) => onPatch({ pregnancyTest: value })}
        options={viewData.options.pregnancyTest}
        selectedValue={record.pregnancyTest}
        testIDPrefix="day-log-pregnancy"
      />
    </View>
  );

  return (
    <FeatureCard
      title={viewData.title}
      description={headerDescription}
    >
      <View onLayout={handleSectionLayout("period")} style={resolveSectionStyle("period")}>
        <BinaryToggleCard
          icon="🩸"
          label={viewData.labels.periodDay}
          onValueChange={(value) => onPatch({ isPeriod: value })}
          testID="day-log-period-toggle"
          value={record.isPeriod}
        />
      </View>

      {record.isPeriod ? (
        <View
          onLayout={handleSectionLayout("flow")}
          style={resolveSectionStyle("flow", styles.section)}
        >
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

      <View
        onLayout={handleSectionLayout("symptoms")}
        style={resolveSectionStyle("symptoms", styles.section)}
      >
        <Text style={styles.sectionLabel}>{viewData.labels.symptoms}</Text>
        <MultiSelectChipGroup
          compact
          onToggle={(value) => {
            const next = record.symptomIDs.includes(value)
              ? record.symptomIDs.filter((current) => current !== value)
              : [...record.symptomIDs, value];
            onPatch({ symptomIDs: next });
          }}
          options={symptomOptions}
          selectedValues={record.symptomIDs}
          testIDPrefix="day-log-symptom"
        />
        {collapsedSymptomsState.hiddenCount > 0 ? (
          <Pressable
            accessibilityLabel={
              showsAllSymptoms
                ? viewData.labels.showFewerSymptoms
                : `${viewData.labels.showMoreSymptoms} (${collapsedSymptomsState.hiddenCount})`
            }
            accessibilityRole="button"
            accessibilityState={{ expanded: showsAllSymptoms }}
            onPress={() => setShowsAllSymptoms((current) => !current)}
            style={styles.moreSymptomsButton}
            testID="day-log-more-symptoms-button"
          >
            <Text style={styles.moreSymptomsText}>
              {showsAllSymptoms
                ? viewData.labels.showFewerSymptoms
                : `${viewData.labels.showMoreSymptoms} (${collapsedSymptomsState.hiddenCount})`}
            </Text>
          </Pressable>
        ) : null}
      </View>

      <View
        onLayout={handleSectionLayout("mood")}
        style={resolveSectionStyle("mood", styles.section)}
      >
        <Text style={styles.sectionLabel}>{viewData.labels.mood}</Text>
        <ChoiceGroup
          compact
          contentAlign="center"
          layout="grid5"
          onClearSelection={() => onPatch({ mood: 0 })}
          onSelect={(value) => onPatch({ mood: value })}
          options={viewData.options.mood}
          selectedValue={record.mood}
          testIDPrefix="day-log-mood"
        />
      </View>

      {viewData.visibility.showCycleFactors ? (
        <View
          onLayout={handleSectionLayout("cycleFactors")}
          style={resolveSectionStyle("cycleFactors", styles.section)}
        >
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
      ) : null}

      {viewData.visibility.showSexActivity ? (
        <View
          onLayout={handleSectionLayout("intimacy")}
          style={resolveSectionStyle("intimacy", styles.section)}
        >
          <Text style={styles.sectionLabel}>{viewData.labels.intimacy}</Text>
          <ChoiceGroup
            compact
            onSelect={(value) => onPatch({ sexActivity: value })}
            options={viewData.options.sexActivity}
            selectedValue={record.sexActivity}
            testIDPrefix="day-log-sex"
          />
        </View>
      ) : null}

      {showsCalendarOrder ? (
        <>
          {bbtSection}
          {cervicalMucusSection}
          {lhTestSection}
          {pregnancyTestSection}
        </>
      ) : (
        <>
          {cervicalMucusSection}
          {lhTestSection}
          {pregnancyTestSection}
          {bbtSection}
        </>
      )}

      {viewData.visibility.showNotes ? (
        <View
          onLayout={handleSectionLayout("notes")}
          style={resolveSectionStyle("notes", styles.section)}
        >
          <View style={styles.notesSection}>
            <Text style={styles.sectionLabel}>{viewData.labels.notes}</Text>
            <AppTextInput
              multiline
              onChangeText={(value) => onPatch({ notes: value })}
              placeholder={viewData.labels.notesPlaceholder}
              style={[styles.input, styles.notesInput]}
              testID="day-log-notes-input"
              value={record.notes}
            />
          </View>
        </View>
      ) : null}

      {showsSaveAction || onCancel ? (
        <View style={styles.actions}>
          {showsSaveAction ? (
            <AppButton
              disabled={isSaving}
              label={entryExists ? viewData.actions.updateLabel : viewData.actions.saveLabel}
              onPress={onSave}
              testID="day-log-save-button"
            />
          ) : null}
          {onCancel ? (
            <AppButton
              disabled={isSaving}
              label={cancelLabel ?? ""}
              onPress={onCancel}
              testID="day-log-cancel-button"
              variant="secondary"
            />
          ) : null}
        </View>
      ) : null}

      {statusMessage ? (
        <StatusBanner message={statusMessage} tone={statusTone} testID="day-log-status-banner" />
      ) : null}

      {onDelete && entryExists ? (
        <View style={styles.dangerSection}>
          <View style={styles.dangerButtonWrap}>
            <AppButton
              disabled={isSaving}
              label={viewData.actions.deleteLabel}
              onPress={onDelete}
              testID="day-log-delete-button"
              variant="danger_secondary"
            />
          </View>
          <Text style={styles.deleteHint}>{viewData.labels.deleteHint}</Text>
        </View>
      ) : null}
    </FeatureCard>
  );
}

const createStyles = (colors: AppThemeColors) =>
  StyleSheet.create({
    section: {
      gap: spacing.sm,
    },
    sectionHighlighted: {
      backgroundColor: colors.accentSoft,
      borderColor: colors.accentStrong,
      borderRadius: 18,
      borderWidth: 1,
      padding: spacing.sm,
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
      backgroundColor: colors.surfaceTint,
      borderColor: colors.lineSoft,
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
    moreSymptomsButton: {
      alignSelf: "flex-start",
    },
    moreSymptomsText: {
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
      alignItems: "flex-start",
      borderTopColor: colors.lineSoft,
      borderTopWidth: 1,
      gap: spacing.xs,
      paddingTop: spacing.sm,
    },
    dangerButtonWrap: {
      alignSelf: "flex-start",
    },
  });

function sanitizeBbtInput(raw: string): string {
  // Monkey-proofing: keep only digits and a single decimal separator, shaped
  // like a temperature (max 3 integer + 2 fractional digits). Anything else the
  // user types (letters, extra dots, overlong values) is dropped before state.
  const cleaned = raw.replace(",", ".").replace(/[^\d.]/g, "");
  const dotIndex = cleaned.indexOf(".");
  if (dotIndex === -1) {
    return cleaned.slice(0, 3);
  }
  const intPart = cleaned.slice(0, dotIndex).slice(0, 3);
  const fracPart = cleaned.slice(dotIndex + 1).replace(/\./g, "").slice(0, 2);
  return `${intPart}.${fracPart}`;
}

function buildCollapsedSymptomOptions(
  options: DayLogEditorViewData["options"]["symptoms"],
  selectedIDs: DayLogRecord["symptomIDs"],
) {
  const MAX_VISIBLE_SYMPTOMS = 6;
  const selected = new Set(selectedIDs);
  const collapsed = options.slice(0, MAX_VISIBLE_SYMPTOMS);
  const remaining: DayLogEditorViewData["options"]["symptoms"][number][] = [];
  const visibleValues = new Set(collapsed.map((option) => option.value));

  for (const option of options.slice(MAX_VISIBLE_SYMPTOMS)) {
    if (selected.has(option.value) && !visibleValues.has(option.value)) {
      remaining.push(option);
      visibleValues.add(option.value);
    }
  }

  return {
    hiddenCount: Math.max(options.length - visibleValues.size, 0),
    options: [...collapsed, ...remaining],
  };
}
