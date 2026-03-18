import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { DayLogRecord } from "../../models/day-log";
import type { DayLogEditorViewData } from "../../services/day-log-editor-service";
import type { DashboardViewData } from "../../services/dashboard-view-service";
import { DayLogEditorCard } from "../components/DayLogEditorCard";
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
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      contentContainerStyle={[
        styles.screenContent,
        { paddingBottom: Math.max(insets.bottom + 16, spacing.xl) },
      ]}
      showsVerticalScrollIndicator={false}
      style={styles.screen}
    >
      <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
        <View style={styles.statusLine}>
          {viewData.statusItems.map((item, index) => (
            <View key={item} style={styles.statusItemRow}>
              {index > 0 ? <Text style={styles.statusSeparator}>·</Text> : null}
              <Text style={styles.statusText}>{item}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.helperText}>{viewData.predictionExplanation}</Text>

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
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  screenContent: {
    paddingBottom: spacing.xl,
  },
  container: {
    alignSelf: "center",
    gap: spacing.md,
    maxWidth: 980,
    paddingHorizontal: 16,
    paddingTop: 16,
    width: "100%",
  },
  statusLine: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  statusItemRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
  },
  statusSeparator: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "700",
  },
  statusText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "600",
  },
  helperText: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
  },
});
