import { StyleSheet, Text, TextInput, View } from "react-native";

import type { LoadedExportState } from "../../models/export";
import type { SettingsViewData } from "../../services/settings-view-service";
import { AppButton } from "./AppButton";
import { ChoiceGroup } from "./ChoiceGroup";
import { FeatureCard } from "./FeatureCard";
import { colors, spacing } from "../theme/tokens";

type SettingsExportSectionProps = {
  errorMessage: string;
  exportState: LoadedExportState;
  isExporting: boolean;
  onCSVExport: () => void | Promise<void>;
  onFromDateChange: (value: string) => void;
  onJSONExport: () => void | Promise<void>;
  onPresetSelect: (value: "all" | "30" | "90" | "365") => void;
  onToDateChange: (value: string) => void;
  statusMessage: string;
  viewData: SettingsViewData["export"];
};

export function SettingsExportSection({
  errorMessage,
  exportState,
  isExporting,
  onCSVExport,
  onFromDateChange,
  onJSONExport,
  onPresetSelect,
  onToDateChange,
  statusMessage,
  viewData,
}: SettingsExportSectionProps) {
  const hasAnyData = exportState.availableSummary.hasData;
  const summaryRange = buildSummaryRangeLabel(
    viewData.summaryRangeTemplate,
    viewData.summaryRangeEmpty,
    exportState,
  );
  const summaryTotal = formatTemplate(viewData.summaryTotalTemplate, [
    String(exportState.summary.totalEntries),
  ]);

  return (
    <FeatureCard title={viewData.title} description={viewData.subtitle}>
      <Text style={styles.helperText}>{viewData.storageHint}</Text>
      <Text style={styles.helperText}>{viewData.sensitiveHint}</Text>

      {hasAnyData ? (
        <>
          <View style={styles.formGroup}>
            <Text style={styles.fieldLabel}>{viewData.presetLabel}</Text>
            <ChoiceGroup
              compact
              onSelect={onPresetSelect}
              options={viewData.presetOptions}
              selectedValue={
                exportState.values.preset === "custom"
                  ? undefined
                  : exportState.values.preset
              }
              testIDPrefix="settings-export-preset"
            />
          </View>

          <View style={styles.rangeRow}>
            <View style={[styles.formGroup, styles.rangeColumn]}>
              <Text style={styles.fieldLabel}>{viewData.fromLabel}</Text>
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="numbers-and-punctuation"
                onChangeText={onFromDateChange}
                placeholder={viewData.datePlaceholder}
                placeholderTextColor={colors.textMuted}
                style={styles.dateInput}
                testID="settings-export-from-input"
                value={exportState.values.fromDate}
              />
            </View>

            <View style={[styles.formGroup, styles.rangeColumn]}>
              <Text style={styles.fieldLabel}>{viewData.toLabel}</Text>
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="numbers-and-punctuation"
                onChangeText={onToDateChange}
                placeholder={viewData.datePlaceholder}
                placeholderTextColor={colors.textMuted}
                style={styles.dateInput}
                testID="settings-export-to-input"
                value={exportState.values.toDate}
              />
            </View>
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryText}>{summaryTotal}</Text>
            <Text style={styles.summaryText}>{summaryRange}</Text>
          </View>

          {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
          {statusMessage ? (
            <Text style={styles.successText}>{statusMessage}</Text>
          ) : null}

          <View style={styles.actionsRow}>
            <AppButton
              disabled={isExporting}
              label={viewData.csvAction}
              onPress={onCSVExport}
              testID="settings-export-csv-button"
              variant="secondary"
            />
            <AppButton
              disabled={isExporting}
              label={viewData.jsonAction}
              onPress={onJSONExport}
              testID="settings-export-json-button"
            />
          </View>
        </>
      ) : (
        <Text style={styles.helperText}>{viewData.noData}</Text>
      )}
    </FeatureCard>
  );
}

function buildSummaryRangeLabel(
  template: string,
  emptyTemplate: string,
  exportState: LoadedExportState,
): string {
  const fromValue = exportState.values.fromDate || exportState.summary.dateFrom;
  const toValue = exportState.values.toDate || exportState.summary.dateTo;
  if (!fromValue || !toValue) {
    return emptyTemplate;
  }

  return formatTemplate(template, [fromValue, toValue]);
}

function formatTemplate(template: string, values: string[]): string {
  let index = 0;
  return String(template).replace(/%[sd]/g, () => {
    const value = index < values.length ? values[index] ?? "" : "";
    index += 1;
    return value;
  });
}

const styles = StyleSheet.create({
  formGroup: {
    gap: spacing.sm,
  },
  rangeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  rangeColumn: {
    flexBasis: "48%",
    flexGrow: 1,
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
  dateInput: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    color: colors.text,
    fontSize: 15,
    fontWeight: "600",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  summaryCard: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  summaryText: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
  },
  actionsRow: {
    gap: spacing.sm,
  },
  errorText: {
    color: "#b42318",
    fontSize: 14,
    lineHeight: 21,
  },
  successText: {
    color: colors.accentStrong,
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 21,
  },
});
