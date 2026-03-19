import { StyleSheet, Text, TextInput, View } from "react-native";

import type { LoadedExportState } from "../../models/export";
import type { SettingsViewData } from "../../services/settings-view-service";
import { AppButton } from "./AppButton";
import { ChoiceGroup } from "./ChoiceGroup";
import { FeatureCard } from "./FeatureCard";
import { StatusBanner } from "./StatusBanner";
import type { AppThemeColors } from "../theme/tokens";
import { spacing } from "../theme/tokens";
import { useAppTheme, useThemedStyles } from "../theme/useThemedStyles";

type SettingsExportSectionProps = {
  errorMessage: string;
  exportState: LoadedExportState;
  isExporting: boolean;
  onCSVExport: () => void | Promise<void>;
  onFromDateChange: (value: string) => void;
  onJSONExport: () => void | Promise<void>;
  onPDFExport: () => void | Promise<void>;
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
  onPDFExport,
  onPresetSelect,
  onToDateChange,
  statusMessage,
  viewData,
}: SettingsExportSectionProps) {
  const { colors } = useAppTheme();
  const styles = useThemedStyles(createStyles);
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
    <FeatureCard
      description={viewData.subtitle}
      testID="settings-export-section"
      title={viewData.title}
    >
      <Text style={styles.helperText}>{viewData.storageHint}</Text>
      <Text style={styles.helperText}>{viewData.sensitiveHint}</Text>

      {hasAnyData ? (
        <>
          <View style={styles.formGroup}>
            <Text style={styles.fieldLabel}>{viewData.presetLabel}</Text>
            <ChoiceGroup
              layout="grid2"
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

          {errorMessage ? (
            <StatusBanner
              message={errorMessage}
              tone="error"
              testID="settings-export-error-banner"
            />
          ) : null}
          {statusMessage ? (
            <StatusBanner
              message={statusMessage}
              tone="success"
              testID="settings-export-status-banner"
            />
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
            <AppButton
              disabled={isExporting}
              label={viewData.pdfAction}
              onPress={onPDFExport}
              testID="settings-export-pdf-button"
              variant="secondary"
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

const createStyles = (colors: AppThemeColors) =>
  StyleSheet.create({
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
  });
