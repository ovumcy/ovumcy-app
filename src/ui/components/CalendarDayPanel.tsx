import { StyleSheet, Text, View } from "react-native";

import type { DayLogRecord } from "../../models/day-log";
import type { CalendarDaySummaryViewData } from "../../services/calendar-view-service";
import type { DayLogEditorViewData } from "../../services/day-log-editor-service";
import type { ManualCycleStartViewData } from "../../services/manual-cycle-start-service";
import { AppButton } from "./AppButton";
import { DayLogEditorCard } from "./DayLogEditorCard";
import { FeatureCard } from "./FeatureCard";
import { ManualCycleStartAction } from "./ManualCycleStartAction";
import { StatusBanner } from "./StatusBanner";
import { colors, spacing } from "../theme/tokens";

type CalendarDayPanelProps = {
  entryExists: boolean;
  isEditing: boolean;
  isSaving: boolean;
  manualCycleStart?: ManualCycleStartViewData | null;
  record: DayLogRecord;
  statusMessage: string;
  statusTone?: "success" | "error" | undefined;
  summaryViewData: CalendarDaySummaryViewData;
  editorViewData: DayLogEditorViewData;
  onAdd: () => void;
  onCancel: () => void;
  onDelete?: () => void | Promise<void>;
  onEdit: () => void;
  onManualCycleStart?: () => void | Promise<void>;
  onPatch: (updates: Partial<DayLogRecord>) => void;
  onSave: () => void | Promise<void>;
};

export function CalendarDayPanel({
  entryExists,
  isEditing,
  isSaving,
  manualCycleStart,
  record,
  statusMessage,
  statusTone,
  summaryViewData,
  editorViewData,
  onAdd,
  onCancel,
  onDelete,
  onEdit,
  onManualCycleStart,
  onPatch,
  onSave,
}: CalendarDayPanelProps) {
  if (isEditing) {
    const deleteProps = onDelete ? { onDelete } : {};

    return (
      <View style={styles.editingStack}>
        <DayLogEditorCard
          cancelLabel={summaryViewData.actions.cancelLabel}
          entryExists={entryExists}
          isSaving={isSaving}
          onCancel={onCancel}
          onPatch={onPatch}
          onSave={onSave}
          record={record}
          statusMessage={statusMessage}
          statusTone={statusTone}
          variant="calendar"
          viewData={{
            ...editorViewData,
            title: summaryViewData.dateLabel,
            subtitle: summaryViewData.subtitle,
            dateLabel: "",
          }}
          {...deleteProps}
        />
        {manualCycleStart && onManualCycleStart ? (
          <ManualCycleStartAction
            disabled={isSaving}
            onPress={onManualCycleStart}
            testID="calendar-day-cycle-start-button"
            viewData={manualCycleStart}
          />
        ) : null}
      </View>
    );
  }

  return (
    <FeatureCard
      description={summaryViewData.subtitle}
      testID="calendar-day-panel"
      title={summaryViewData.dateLabel}
    >
      {statusMessage ? (
        <StatusBanner
          message={statusMessage}
          testID="calendar-day-status-banner"
          tone={statusTone ?? "success"}
        />
      ) : null}

      {entryExists ? (
        <>
          <View style={styles.summaryCard}>
            {summaryViewData.summaryRows.map((row) => (
              <View key={row.key} style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{row.label}</Text>
                <Text style={styles.summaryValue}>{row.value}</Text>
              </View>
            ))}
          </View>

          <View style={styles.summarySection}>
            <Text style={styles.summaryLabel}>{summaryViewData.symptomsLabel}</Text>
            <Text style={styles.summaryValue}>{summaryViewData.symptomsValue}</Text>
          </View>

          <View style={styles.actionsRow}>
            <AppButton
              label={summaryViewData.actions.editEntryLabel}
              onPress={onEdit}
              testID="calendar-day-edit-button"
              variant="secondary"
            />
          </View>
        </>
      ) : (
        <>
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>{summaryViewData.noEntryLabel}</Text>
          </View>

          <View style={styles.actionsRow}>
            <AppButton
              label={summaryViewData.actions.addEntryLabel}
              onPress={onAdd}
              testID="calendar-day-add-button"
            />
          </View>
        </>
      )}

      {manualCycleStart && onManualCycleStart ? (
        <ManualCycleStartAction
          disabled={isSaving}
          onPress={onManualCycleStart}
          testID="calendar-day-cycle-start-button"
          viewData={manualCycleStart}
        />
      ) : null}
    </FeatureCard>
  );
}

const styles = StyleSheet.create({
  editingStack: {
    gap: spacing.md,
  },
  summaryCard: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 14,
    gap: spacing.sm,
    padding: 14,
  },
  summaryRow: {
    gap: 4,
  },
  summaryLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "600",
  },
  summaryValue: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  summarySection: {
    gap: 4,
  },
  emptyState: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 14,
    padding: 14,
  },
  emptyStateText: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 21,
  },
  actionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
});
