import { type ReactNode, useRef } from "react";
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
import { AppScreenSurface } from "../components/AppScreenSurface";
import { CalendarDayPanel } from "../components/CalendarDayPanel";
import { CalendarMonthGrid } from "../components/CalendarMonthGrid";
import { StatusBanner } from "../components/StatusBanner";
import type { AppThemeColors } from "../theme/tokens";
import { spacing } from "../theme/tokens";
import { useAppTheme, useThemedStyles } from "../theme/useThemedStyles";

type CalendarOverviewScreenProps = {
  entryExists: boolean;
  editorViewData: DayLogEditorViewData;
  isEditing: boolean;
  isSaving: boolean;
  manualCycleStart?: ManualCycleStartViewData | null;
  onAddEntry: () => void;
  onCancelEdit: () => void;
  onDelete: () => void | Promise<void>;
  onDismissPredictionNotice?: (() => void | Promise<void>) | undefined;
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
  onDismissPredictionNotice,
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
  const styles = useThemedStyles(createStyles);
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isWide = width >= 960;
  const scrollViewRef = useRef<ScrollView | null>(null);
  const editorColumnOffsetRef = useRef(0);
  const manualCycleStartProps =
    manualCycleStart !== undefined ? { manualCycleStart } : {};
  const manualCycleStartHandlerProps = onManualCycleStart
    ? { onManualCycleStart }
    : {};

  return (
    <AppScreenSurface>
      <ScrollView
        contentContainerStyle={[
          styles.screenContent,
          { paddingBottom: Math.max(insets.bottom + 104, spacing.xl + 48) },
        ]}
        ref={scrollViewRef}
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
              {viewData.predictionNotice ? (
                <StatusBanner
                  dismissLabel={viewData.predictionNotice.dismissLabel}
                  message={viewData.predictionNotice.message}
                  onDismiss={onDismissPredictionNotice}
                  testID="calendar-prediction-mode-banner"
                  tone="info"
                />
              ) : null}
              <CalendarMonthGrid
                days={viewData.days}
                onSelectDay={(day) => {
                  onSelectDay(day);
                  if (!isWide) {
                    requestAnimationFrame(() => {
                      scrollViewRef.current?.scrollTo({
                        animated: true,
                        y: Math.max(editorColumnOffsetRef.current - 20, 0),
                      });
                    });
                  }
                }}
                todayLabel={viewData.legend.today}
              />

              <View style={styles.legendBlock}>
                <Text style={styles.legendGuide}>{viewData.legend.guide}</Text>

                <View style={styles.legendSection}>
                  <Text style={styles.legendSectionTitle}>
                    {viewData.legend.meaningTitle}
                  </Text>
                  <View style={styles.legend}>
                    <LegendItem label={viewData.legend.recordedPeriod} styles={styles}>
                      <LegendCellSwatch
                        borderColor={colors.calendarPeriodBorder}
                        backgroundColor={colors.calendarPeriodBg}
                        styles={styles}
                      />
                    </LegendItem>
                    {!viewData.isPredictionDisabled ? (
                      <>
                        <LegendItem label={viewData.legend.predictedPeriod} styles={styles}>
                          <LegendCellSwatch
                            backgroundColor={colors.calendarPredictedBg}
                            borderColor={colors.calendarPredictedBorder}
                            borderStyle="dashed"
                            styles={styles}
                          />
                        </LegendItem>
                        <LegendItem label={viewData.legend.lowProbability} styles={styles}>
                          <LegendCellSwatch
                            backgroundColor={colors.calendarPreFertileBg}
                            borderColor={colors.calendarPreFertileBorder}
                            borderStyle="dashed"
                            styles={styles}
                          />
                        </LegendItem>
                        <LegendItem label={viewData.legend.fertilityEdge} styles={styles}>
                          <LegendCellSwatch
                            backgroundColor={colors.calendarFertilityEdgeBg}
                            borderColor={colors.calendarFertilityEdgeBorder}
                            styles={styles}
                          />
                        </LegendItem>
                        <LegendItem label={viewData.legend.fertilityPeak} styles={styles}>
                          <LegendCellSwatch
                            backgroundColor={colors.calendarFertilityPeakBg}
                            borderColor={colors.calendarFertilityPeakBorder}
                            styles={styles}
                          />
                        </LegendItem>
                        <LegendItem label={viewData.legend.ovulation} styles={styles}>
                          <LegendCellSwatch
                            backgroundColor={colors.calendarFertilityPeakBg}
                            borderColor={colors.calendarFertilityPeakBorder}
                            marker="ovulation"
                            styles={styles}
                          />
                        </LegendItem>
                        <LegendItem label={viewData.legend.ovulationTentative} styles={styles}>
                          <LegendCellSwatch
                            backgroundColor={colors.calendarTentativeBg}
                            borderColor={colors.calendarTentativeBorder}
                            borderStyle="dashed"
                            marker="tentative"
                            styles={styles}
                          />
                        </LegendItem>
                      </>
                    ) : null}
                  </View>
                </View>

                <View style={styles.legendSection}>
                  <Text style={styles.legendSectionTitle}>
                    {viewData.legend.markersTitle}
                  </Text>
                  <View style={styles.legend}>
                    <LegendItem label={viewData.legend.loggedEntry} styles={styles}>
                      <LegendCellSwatch marker="entry" styles={styles} />
                    </LegendItem>
                    <LegendItem label={viewData.legend.sexLogged} styles={styles}>
                      <LegendCellSwatch marker="heart" styles={styles} />
                    </LegendItem>
                    <LegendItem label={viewData.legend.today} styles={styles}>
                      <LegendCellSwatch marker="today" styles={styles} />
                    </LegendItem>
                  </View>
                </View>
              </View>
            </View>
          </View>

          <View
            onLayout={(event) => {
              editorColumnOffsetRef.current = event.nativeEvent.layout.y;
            }}
            style={styles.editorColumn}
          >
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
    </AppScreenSurface>
  );
}

function LegendItem({
  children,
  label,
  styles,
}: {
  children: ReactNode;
  label: string;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.legendItem}>
      {children}
      <Text style={styles.legendLabel}>{label}</Text>
    </View>
  );
}

function LegendCellSwatch({
  backgroundColor,
  borderColor,
  borderStyle = "solid",
  marker,
  styles,
}: {
  backgroundColor?: string;
  borderColor?: string;
  borderStyle?: "solid" | "dashed";
  marker?: "entry" | "heart" | "ovulation" | "tentative" | "today";
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View
      style={[
        styles.legendCellSwatch,
        backgroundColor ? { backgroundColor } : null,
        borderColor
          ? {
              borderColor,
              borderStyle,
            }
          : null,
      ]}
    >
      {marker === "entry" ? <View style={styles.legendEntryMarker} /> : null}
      {marker === "ovulation" ? <View style={styles.legendOvulationMarker} /> : null}
      {marker === "tentative" ? <View style={styles.legendOvulationDash} /> : null}
      {marker === "heart" ? <Text style={styles.legendHeart}>♥</Text> : null}
      {marker === "today" ? (
        <View style={styles.legendTodayPill}>
          <View style={styles.legendTodayPillCore} />
        </View>
      ) : null}
    </View>
  );
}

const createStyles = (colors: AppThemeColors) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: "transparent",
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
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.lineSoft,
      borderRadius: 18,
      borderWidth: 1,
      gap: spacing.sm,
      padding: 16,
      shadowColor: colors.shadowSoft,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.82,
      shadowRadius: 24,
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
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.lineSoft,
      borderRadius: 18,
      borderWidth: 1,
      gap: spacing.md,
      padding: 16,
      shadowColor: colors.shadowSoft,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.82,
      shadowRadius: 24,
    },
    editorColumn: {
      flex: 1,
      minWidth: 0,
    },
    legendBlock: {
      gap: spacing.sm,
    },
    legendSection: {
      gap: spacing.xs,
    },
    legendSectionTitle: {
      color: colors.text,
      fontSize: 12,
      fontWeight: "700",
      textTransform: "uppercase",
    },
    legendGuide: {
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 18,
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
    legendCellSwatch: {
      alignItems: "center",
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 8,
      borderWidth: 1,
      height: 18,
      justifyContent: "center",
      width: 22,
    },
    legendEntryMarker: {
      backgroundColor: colors.calendarDataMarkerBg,
      borderRadius: 999,
      height: 7,
      width: 7,
    },
    legendOvulationMarker: {
      backgroundColor: colors.calendarOvulationMarkerBg,
      borderRadius: 999,
      height: 8,
      width: 8,
    },
    legendOvulationDash: {
      backgroundColor: colors.calendarOvulationDashBg,
      borderRadius: 999,
      height: 3,
      width: 12,
    },
    legendHeart: {
      color: colors.accentStrong,
      fontSize: 12,
      fontWeight: "700",
    },
    legendTodayPill: {
      alignItems: "center",
      justifyContent: "center",
    },
    legendTodayPillCore: {
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.border,
      borderRadius: 999,
      borderWidth: 1,
      height: 8,
      width: 14,
    },
  });
