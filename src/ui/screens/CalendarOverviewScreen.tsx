import type { ReactNode } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { DayLogRecord } from "../../models/day-log";
import type {
  CalendarDaySummaryViewData,
  CalendarDayCellViewData,
  CalendarViewData,
} from "../../services/calendar-view-service";
import type { DayLogEditorViewData } from "../../services/day-log-editor-service";
import type { ManualCycleStartViewData } from "../../services/manual-cycle-start-service";
import { AppButton } from "../components/AppButton";
import { CalendarDayPanel } from "../components/CalendarDayPanel";
import { CalendarMonthGrid } from "../components/CalendarMonthGrid";
import { colors, spacing } from "../theme/tokens";

type CalendarOverviewScreenProps = {
  entryExists: boolean;
  editorViewData: DayLogEditorViewData;
  isEditing: boolean;
  isSaving: boolean;
  manualCycleStart?: ManualCycleStartViewData | null;
  onAddEntry: () => void;
  onCancelEdit: () => void;
  onDelete: () => void | Promise<void>;
  onManualCycleStart?: (() => void | Promise<void>) | undefined;
  onNextMonth: () => void;
  onPatch: (updates: Partial<DayLogRecord>) => void;
  onPrevMonth: () => void;
  onSave: () => void | Promise<void>;
  onSelectDay: (day: CalendarDayCellViewData) => void;
  onStartEdit: () => void;
  onToday: () => void;
  record: DayLogRecord;
  statusMessage: string;
  statusTone?: "success" | "error" | undefined;
  summaryViewData: CalendarDaySummaryViewData;
  viewData: CalendarViewData;
};

export function CalendarOverviewScreen({
  entryExists,
  editorViewData,
  isEditing,
  isSaving,
  manualCycleStart,
  onAddEntry,
  onCancelEdit,
  onDelete,
  onManualCycleStart,
  onNextMonth,
  onPatch,
  onPrevMonth,
  onSave,
  onSelectDay,
  onStartEdit,
  onToday,
  record,
  statusMessage,
  statusTone,
  summaryViewData,
  viewData,
}: CalendarOverviewScreenProps) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isWide = width >= 960;
  const manualCycleStartProps =
    manualCycleStart !== undefined ? { manualCycleStart } : {};
  const manualCycleStartHandlerProps = onManualCycleStart
    ? { onManualCycleStart }
    : {};

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
        <View style={styles.headerCard}>
          <View style={styles.headerCopy}>
            <Text style={styles.headerTitle}>{viewData.title}</Text>
            <Text style={styles.headerDescription}>{viewData.monthLabel}</Text>
          </View>
          <View style={styles.actions}>
            <AppButton
              label={viewData.actions.prevLabel}
              onPress={onPrevMonth}
              testID="calendar-prev-button"
              variant="secondary"
            />
            <AppButton
              label={viewData.actions.nextLabel}
              onPress={onNextMonth}
              testID="calendar-next-button"
              variant="secondary"
            />
            <AppButton
              label={viewData.actions.todayLabel}
              onPress={onToday}
              testID="calendar-today-button"
            />
          </View>
        </View>

        <View style={[styles.mainGrid, isWide ? styles.mainGridWide : null]}>
          <View style={styles.monthColumn}>
            <View style={styles.monthCard}>
              <CalendarMonthGrid days={viewData.days} onSelectDay={onSelectDay} />

              <View style={styles.legend}>
                <LegendItem label={viewData.legend.recordedPeriod}>
                  <View style={[styles.legendDot, styles.legendDotPeriod]} />
                </LegendItem>
                {!viewData.isPredictionDisabled ? (
                  <>
                    <LegendItem label={viewData.legend.predictedPeriod}>
                      <View style={[styles.legendDot, styles.legendDotPredicted]} />
                    </LegendItem>
                    <LegendItem label={viewData.legend.lowProbability}>
                      <View style={styles.legendOutline} />
                    </LegendItem>
                    <LegendItem label={viewData.legend.fertilityEdge}>
                      <View style={[styles.legendDot, styles.legendDotFertilityEdge]} />
                    </LegendItem>
                    <LegendItem label={viewData.legend.fertilityPeak}>
                      <View style={[styles.legendDot, styles.legendDotFertilityPeak]} />
                    </LegendItem>
                    <LegendItem label={viewData.legend.ovulation}>
                      <View style={styles.legendOvulationDot} />
                    </LegendItem>
                    <LegendItem label={viewData.legend.ovulationTentative}>
                      <View style={styles.legendOvulationDash} />
                    </LegendItem>
                  </>
                ) : null}
                <LegendItem label={viewData.legend.loggedEntry}>
                  <View style={styles.legendDataMarker} />
                </LegendItem>
                <LegendItem label={viewData.legend.sexLogged}>
                  <Text style={styles.legendHeart}>♥</Text>
                </LegendItem>
              </View>
            </View>
          </View>

          <View style={styles.editorColumn}>
            <CalendarDayPanel
              editorViewData={editorViewData}
              entryExists={entryExists}
              isEditing={isEditing}
              isSaving={isSaving}
              onAdd={onAddEntry}
              onCancel={onCancelEdit}
              onDelete={onDelete}
              onEdit={onStartEdit}
              onPatch={onPatch}
              onSave={onSave}
              record={record}
              statusMessage={statusMessage}
              statusTone={statusTone}
              summaryViewData={summaryViewData}
              {...manualCycleStartProps}
              {...manualCycleStartHandlerProps}
            />
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

function LegendItem({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <View style={styles.legendItem}>
      {children}
      <Text style={styles.legendLabel}>{label}</Text>
    </View>
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
    maxWidth: 1100,
    paddingHorizontal: 16,
    paddingTop: 16,
    width: "100%",
  },
  headerCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    gap: spacing.sm,
    padding: 16,
  },
  headerCopy: {
    gap: 4,
  },
  headerTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
  },
  headerDescription: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 20,
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  mainGrid: {
    gap: 20,
  },
  mainGridWide: {
    flexDirection: "row",
  },
  monthColumn: {
    flex: 2,
    minWidth: 0,
  },
  monthCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    gap: spacing.md,
    padding: 16,
  },
  editorColumn: {
    flex: 1,
    minWidth: 0,
  },
  legend: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  legendItem: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
  },
  legendLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "600",
  },
  legendDot: {
    borderRadius: 999,
    height: 8,
    width: 8,
  },
  legendDotPeriod: {
    backgroundColor: "#c7756d",
  },
  legendDotPredicted: {
    backgroundColor: colors.accentSecondary,
  },
  legendDotFertilityEdge: {
    backgroundColor: "#e7b88f",
  },
  legendDotFertilityPeak: {
    backgroundColor: "#dd9b81",
  },
  legendOutline: {
    borderColor: colors.accentSecondary,
    borderRadius: 999,
    borderWidth: 1,
    height: 10,
    width: 10,
  },
  legendOvulationDot: {
    backgroundColor: "#f0906f",
    borderRadius: 999,
    height: 10,
    width: 10,
  },
  legendOvulationDash: {
    backgroundColor: "#e0a37d",
    borderRadius: 999,
    height: 3,
    width: 12,
  },
  legendDataMarker: {
    backgroundColor: colors.accentStrong,
    borderRadius: 999,
    height: 8,
    width: 8,
  },
  legendHeart: {
    color: colors.accentStrong,
    fontSize: 12,
    fontWeight: "700",
  },
});
