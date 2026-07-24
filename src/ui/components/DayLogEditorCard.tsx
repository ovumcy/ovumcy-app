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
  // Precomputed by shared services (day-log-editor-service.resolveBleedingSafetyHint):
  // a non-diagnostic ACOG-guidance hint shown under the flow field for prolonged
  // or sustained very heavy bleeding. null hides the element entirely.
  bleedingSafetyHint?: string | null;
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
  | "pregnancyMetrics"
  | "notes";

export function DayLogEditorCard({
  bleedingSafetyHint = null,
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

  // Pregnancy metrics (weightKg/bpSystolic/bpDiastolic) are genuinely
  // optional -- unlike bbt's 0-sentinel, "no reading" is represented by the
  // key being absent from the record (see models/day-log.ts). Passing the
  // numeric 0 here (never `undefined`, which exactOptionalPropertyTypes
  // would reject for an optional `number` prop) is TS-legal and reaches the
  // same "absent" outcome: normalizeDayWeightKg/normalizeDayBpSystolic/
  // normalizeDayBpDiastolic reject 0 as below their minimum and
  // sanitizeDayLogRecord then omits the key entirely -- mirroring how an
  // emptied BBT field resolves to 0="not entered".
  const [metricsKey, setMetricsKey] = useState(record.date);
  const [weightText, setWeightText] = useState(() =>
    formatOptionalDecimal(record.weightKg),
  );
  const [systolicText, setSystolicText] = useState(() =>
    formatOptionalInteger(record.bpSystolic),
  );
  const [diastolicText, setDiastolicText] = useState(() =>
    formatOptionalInteger(record.bpDiastolic),
  );
  if (record.date !== metricsKey) {
    setMetricsKey(record.date);
    setWeightText(formatOptionalDecimal(record.weightKg));
    setSystolicText(formatOptionalInteger(record.bpSystolic));
    setDiastolicText(formatOptionalInteger(record.bpDiastolic));
  }

  function handleWeightChange(value: string) {
    const sanitized = sanitizeWeightInput(value);
    setWeightText(sanitized);
    const parsed = Number(sanitized);
    onPatch({ weightKg: Number.isFinite(parsed) && parsed > 0 ? parsed : 0 });
  }

  function handleSystolicChange(value: string) {
    const sanitized = sanitizeBpInput(value);
    setSystolicText(sanitized);
    const parsed = Number(sanitized);
    onPatch({ bpSystolic: Number.isFinite(parsed) && parsed > 0 ? parsed : 0 });
  }

  function handleDiastolicChange(value: string) {
    const sanitized = sanitizeBpInput(value);
    setDiastolicText(sanitized);
    const parsed = Number(sanitized);
    onPatch({ bpDiastolic: Number.isFinite(parsed) && parsed > 0 ? parsed : 0 });
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
        accessibilityLabel={viewData.labels.bbt}
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
        groupLabel={viewData.labels.cervicalMucus}
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
        groupLabel={viewData.labels.lhTest}
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
        groupLabel={viewData.labels.pregnancyTest}
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
            groupLabel={viewData.labels.flow}
            onSelect={(value) => onPatch({ flow: value })}
            options={viewData.options.flow}
            selectedValue={record.flow}
            testIDPrefix="day-log-flow"
          />
          {bleedingSafetyHint ? (
            <Text style={styles.bleedingSafetyHint} testID="day-log-bleeding-safety-hint">
              {bleedingSafetyHint}
            </Text>
          ) : null}
        </View>
      ) : null}

      <View
        onLayout={handleSectionLayout("symptoms")}
        style={resolveSectionStyle("symptoms", styles.section)}
      >
        <Text style={styles.sectionLabel}>{viewData.labels.symptoms}</Text>
        <MultiSelectChipGroup
          compact
          groupLabel={viewData.labels.symptoms}
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
          groupLabel={viewData.labels.mood}
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
            groupLabel={viewData.labels.cycleFactors}
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
            groupLabel={viewData.labels.intimacy}
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

      {viewData.visibility.showPregnancyMetrics ? (
        <View
          onLayout={handleSectionLayout("pregnancyMetrics")}
          style={resolveSectionStyle("pregnancyMetrics", styles.section)}
        >
          <View style={styles.metricGroup}>
            <Text style={styles.sectionLabel}>{viewData.labels.weight}</Text>
            <Text style={styles.sectionHint}>{viewData.labels.weightHint}</Text>
            <View style={styles.metricInputRow}>
              <AppTextInput
                inputMode="decimal"
                maxLength={6}
                onBlur={() => setWeightText(formatOptionalDecimal(record.weightKg))}
                onChangeText={handleWeightChange}
                placeholder="0.00"
                style={[styles.input, styles.metricInput]}
                testID="day-log-weight-input"
                value={weightText}
              />
              <Text style={styles.metricUnit}>{viewData.labels.weightUnit}</Text>
            </View>
          </View>

          <View style={styles.metricGroup}>
            <Text style={styles.sectionLabel}>{viewData.labels.bloodPressure}</Text>
            <Text style={styles.sectionHint}>{viewData.labels.bloodPressureHint}</Text>
            <View style={styles.metricInputRow}>
              <AppTextInput
                inputMode="numeric"
                keyboardType="number-pad"
                maxLength={3}
                onBlur={() => setSystolicText(formatOptionalInteger(record.bpSystolic))}
                onChangeText={handleSystolicChange}
                placeholder={viewData.labels.bloodPressureSystolicPlaceholder}
                style={[styles.input, styles.metricInput]}
                testID="day-log-bp-systolic-input"
                value={systolicText}
              />
              <Text style={styles.metricSeparator}>/</Text>
              <AppTextInput
                inputMode="numeric"
                keyboardType="number-pad"
                maxLength={3}
                onBlur={() => setDiastolicText(formatOptionalInteger(record.bpDiastolic))}
                onChangeText={handleDiastolicChange}
                placeholder={viewData.labels.bloodPressureDiastolicPlaceholder}
                style={[styles.input, styles.metricInput]}
                testID="day-log-bp-diastolic-input"
                value={diastolicText}
              />
              <Text style={styles.metricUnit}>{viewData.labels.bloodPressureUnit}</Text>
            </View>
          </View>
        </View>
      ) : null}

      {viewData.visibility.showNotes ? (
        <View
          onLayout={handleSectionLayout("notes")}
          style={resolveSectionStyle("notes", styles.section)}
        >
          <View style={styles.notesSection}>
            <Text style={styles.sectionLabel}>{viewData.labels.notes}</Text>
            <AppTextInput
              accessibilityLabel={viewData.labels.notes}
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
    bleedingSafetyHint: {
      backgroundColor: colors.accentSoft,
      borderRadius: 12,
      color: colors.text,
      fontSize: 13,
      lineHeight: 19,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
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
    metricGroup: {
      gap: spacing.xs,
    },
    metricInputRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.xs,
    },
    metricInput: {
      flexGrow: 1,
      flexShrink: 1,
      minWidth: 64,
    },
    metricUnit: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: "600",
    },
    metricSeparator: {
      color: colors.textMuted,
      fontSize: 15,
      fontWeight: "700",
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

// Same shape as sanitizeBbtInput (max 3 integer + 2 fractional digits), which
// happens to fit the 30-250 kg weight range too -- kept as its own function
// since it sanitizes a different domain field, not a refactor of the BBT path.
function sanitizeWeightInput(raw: string): string {
  const cleaned = raw.replace(",", ".").replace(/[^\d.]/g, "");
  const dotIndex = cleaned.indexOf(".");
  if (dotIndex === -1) {
    return cleaned.slice(0, 3);
  }
  const intPart = cleaned.slice(0, dotIndex).slice(0, 3);
  const fracPart = cleaned.slice(dotIndex + 1).replace(/\./g, "").slice(0, 2);
  return `${intPart}.${fracPart}`;
}

// Blood pressure is stored as a whole mmHg number (normalizeDayBpSystolic /
// normalizeDayBpDiastolic round to the nearest integer) -- digits only, up to
// 3 of them.
function sanitizeBpInput(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 3);
}

// weightKg/bpSystolic/bpDiastolic are genuinely optional (absent, never a
// 0-sentinel) -- these render an absent or non-positive value as an empty
// field rather than "0", matching normalizeDayWeightKg/
// normalizeDayBpSystolic/normalizeDayBpDiastolic's own absent-below-minimum
// treatment of 0.
function formatOptionalDecimal(value: number | undefined): string {
  return value !== undefined && Number.isFinite(value) && value > 0
    ? String(value)
    : "";
}

function formatOptionalInteger(value: number | undefined): string {
  return value !== undefined && Number.isFinite(value) && value > 0
    ? String(Math.round(value))
    : "";
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
