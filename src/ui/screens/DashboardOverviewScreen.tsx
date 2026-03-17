import { StyleSheet, Text, View } from "react-native";

import type { DayLogRecord } from "../../models/day-log";
import type { DayLogEditorViewData } from "../../services/day-log-editor-service";
import type { DashboardViewData } from "../../services/dashboard-view-service";
import { DayLogEditorCard } from "../components/DayLogEditorCard";
import { FeatureCard } from "../components/FeatureCard";
import { ScreenScaffold } from "../components/ScreenScaffold";
import { colors, spacing } from "../theme/tokens";

type DashboardOverviewScreenProps = {
  entryExists: boolean;
  editorViewData: DayLogEditorViewData;
  isSaving: boolean;
  onDelete: () => void | Promise<void>;
  onPatch: (updates: Partial<DayLogRecord>) => void;
  onSave: () => void | Promise<void>;
  record: DayLogRecord;
  statusMessage: string;
  viewData: DashboardViewData;
};

export function DashboardOverviewScreen({
  entryExists,
  editorViewData,
  isSaving,
  onDelete,
  onPatch,
  onSave,
  record,
  statusMessage,
  viewData,
}: DashboardOverviewScreenProps) {
  return (
    <ScreenScaffold
      eyebrow={viewData.eyebrow}
      title={viewData.title}
      description={viewData.description}
    >
      <View style={styles.statusLine}>
        {viewData.statusItems.map((item) => (
          <View key={item} style={styles.statusChip}>
            <Text style={styles.statusChipText}>{item}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.helperText}>{viewData.predictionExplanation}</Text>

      <FeatureCard
        title={viewData.snapshot.title}
        description="Resolved from your saved local cycle settings."
      >
        <View style={styles.snapshotGrid}>
          {viewData.snapshot.items.map((item) => (
            <View key={item.label} style={styles.snapshotItem}>
              <Text style={styles.snapshotLabel}>{item.label}</Text>
              <Text style={styles.snapshotValue}>{item.value}</Text>
            </View>
          ))}
        </View>
      </FeatureCard>

      <DayLogEditorCard
        entryExists={entryExists}
        isSaving={isSaving}
        onDelete={onDelete}
        onPatch={onPatch}
        onSave={onSave}
        record={record}
        statusMessage={statusMessage}
        viewData={{
          ...editorViewData,
          title: viewData.journal.title,
          subtitle: viewData.journal.description,
          dateLabel: viewData.journal.dateLabel,
        }}
      />
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  statusLine: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  statusChip: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
  },
  statusChipText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "600",
  },
  helperText: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
  },
  snapshotGrid: {
    gap: spacing.sm,
  },
  snapshotItem: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 18,
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  snapshotLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "600",
  },
  snapshotValue: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
  },
});
