import { type ReactNode, useRef, useState } from "react";
import {
  Pressable,
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
import { CalendarStateDecor } from "../components/CalendarStateDecor";
import { StatusBanner } from "../components/StatusBanner";
import type { AppThemeColors } from "../theme/tokens";
import { spacing } from "../theme/tokens";
import { useThemedStyles } from "../theme/useThemedStyles";

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
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isWide = width >= 960;
  const isCompact = width < 430;
  const [isLegendExpanded, setIsLegendExpanded] = useState(false);
  const showLegendToggle = isCompact;
  const showLegend = !isCompact || isLegendExpanded;
  const hasTentativeOvulationDays = viewData.days.some(
    (day) => day.stateKey === "ovulation_tentative",
  );
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
          <View style={[styles.mainGrid, isWide ? styles.mainGridWide : null]}>
            <View style={styles.monthColumn}>
              <View style={styles.monthCard}>
                <View
                  style={[
                    styles.monthCardHeader,
                    isCompact ? styles.monthCardHeaderCompact : null,
                  ]}
                >
                  <View style={styles.headerCopy}>
                    <Text style={styles.headerTitle}>{viewData.title}</Text>
                    <Text style={styles.headerDescription}>{viewData.monthLabel}</Text>
                  </View>
                  <View
                    style={[styles.actions, isCompact ? styles.actionsCompact : null]}
                  >
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
                  weekdayLabels={viewData.weekdayLabels}
                />

                {showLegendToggle ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      setIsLegendExpanded((current) => !current);
                    }}
                    style={styles.legendToggle}
                    testID="calendar-legend-toggle"
                  >
                    <Text style={styles.legendToggleLabel}>
                      {showLegend
                        ? viewData.legend.hideLegend
                        : viewData.legend.showLegend}
                    </Text>
                    <Text style={styles.legendToggleIcon}>{showLegend ? "−" : "+"}</Text>
                  </Pressable>
                ) : null}

                {showLegend ? (
                  <View
                    style={styles.legendBlock}
                    testID={isCompact ? "calendar-legend-expanded" : "calendar-legend"}
                  >
                    <View style={styles.legendFlow}>
                      <LegendItem label={viewData.legend.recordedPeriod} styles={styles}>
                      <View style={[styles.legendDot, styles.legendDotPeriod]} />
                    </LegendItem>
                    {!viewData.isPredictionDisabled ? (
                      <>
                        <LegendItem label={viewData.legend.predictedPeriod} styles={styles}>
                          <View style={[styles.legendDot, styles.legendDotPredicted]} />
                        </LegendItem>
                        <LegendItem label={viewData.legend.lowProbability} styles={styles}>
                          <View style={styles.legendOutline} />
                        </LegendItem>
                        <LegendItem label={viewData.legend.fertilityEdge} styles={styles}>
                          <View style={[styles.legendDot, styles.legendDotFertilityEdge]} />
                        </LegendItem>
                        <LegendItem label={viewData.legend.fertilityPeak} styles={styles}>
                          <View style={[styles.legendDot, styles.legendDotFertilityPeak]} />
                        </LegendItem>
                        <LegendItem label={viewData.legend.ovulation} styles={styles}>
                          <CalendarStateDecor stateKey="ovulation" variant="legend" />
                        </LegendItem>
                        {hasTentativeOvulationDays ? (
                          <LegendItem label={viewData.legend.ovulationTentative} styles={styles}>
                            <CalendarStateDecor
                              stateKey="ovulation_tentative"
                              variant="legend"
                            />
                          </LegendItem>
                        ) : null}
                      </>
                    ) : null}
                    <LegendItem label={viewData.legend.loggedEntry} styles={styles}>
                      <View style={[styles.legendDot, styles.legendDotData]} />
                    </LegendItem>
                    <LegendItem label={viewData.legend.sexLogged} styles={styles}>
                      <Text style={styles.legendHeart}>♥</Text>
                    </LegendItem>
                  </View>
                  </View>
                ) : null}
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
      <Text numberOfLines={2} style={styles.legendLabel}>
        {label}
      </Text>
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
    monthCardHeader: {
      gap: spacing.sm,
    },
    monthCardHeaderCompact: {
      gap: spacing.xs,
    },
    headerCopy: {
      gap: 4,
    },
    headerTitle: {
      color: colors.text,
      fontSize: 17,
      fontWeight: "700",
      lineHeight: 22,
    },
    headerDescription: {
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 18,
    },
    actions: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
    },
    actionsCompact: {
      gap: spacing.xs,
    },
    mainGrid: {
      gap: 16,
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
      gap: spacing.sm,
      padding: 14,
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
      gap: spacing.xs,
      marginTop: 2,
    },
    legendToggle: {
      alignItems: "center",
      alignSelf: "flex-start",
      backgroundColor: colors.surface,
      borderColor: colors.lineSoft,
      borderRadius: 999,
      borderWidth: 1,
      flexDirection: "row",
      gap: 8,
      marginTop: 2,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    legendToggleLabel: {
      color: colors.text,
      fontSize: 12,
      fontWeight: "600",
      lineHeight: 16,
    },
    legendToggleIcon: {
      color: colors.textMuted,
      fontSize: 16,
      fontWeight: "700",
      lineHeight: 16,
      marginTop: -1,
    },
    legendFlow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.xs,
    },
    legendItem: {
      alignItems: "center",
      flexDirection: "row",
      gap: 6,
    },
    legendLabel: {
      color: colors.text,
      flexShrink: 1,
      fontSize: 11,
      fontWeight: "600",
      lineHeight: 14,
    },
    legendDot: {
      borderRadius: 999,
      flexShrink: 0,
      height: 10,
      width: 10,
    },
    legendDotPeriod: {
      backgroundColor: colors.calendarPeriodBorder,
    },
    legendDotPredicted: {
      backgroundColor: colors.calendarPredictedBorder,
    },
    legendDotFertilityEdge: {
      backgroundColor: colors.calendarFertilityEdgeBorder,
      borderRadius: 3,
    },
    legendDotFertilityPeak: {
      backgroundColor: colors.calendarFertilityPeakBorder,
      borderRadius: 3,
    },
    legendDotData: {
      backgroundColor: colors.calendarDataMarkerBg,
      shadowColor: colors.calendarDataMarkerBg,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
    },
    legendOutline: {
      backgroundColor: colors.surface,
      borderColor: colors.calendarPreFertileBorder,
      borderRadius: 3,
      borderStyle: "dashed",
      borderWidth: 1,
      flexShrink: 0,
      height: 10,
      width: 10,
    },
    legendHeart: {
      color: colors.accentStrong,
      fontSize: 11,
      fontWeight: "700",
      lineHeight: 12,
    },
  });
