import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { CalendarDayCellViewData } from "../../services/calendar-view-service";
import type { AppThemeColors } from "../theme/tokens";
import { spacing } from "../theme/tokens";
import { useThemedStyles } from "../theme/useThemedStyles";
import { CalendarStateDecor } from "./CalendarStateDecor";

type CalendarMonthGridProps = {
  days: CalendarDayCellViewData[];
  onSelectDay: (day: CalendarDayCellViewData) => void;
  todayLabel: string;
  weekdayLabels: string[];
};

export function CalendarMonthGrid({
  days,
  onSelectDay,
  todayLabel,
  weekdayLabels,
}: CalendarMonthGridProps) {
  const styles = useThemedStyles(createStyles);
  const [gridWidth, setGridWidth] = useState(0);
  const weeks = useMemo(() => {
    const rows: CalendarDayCellViewData[][] = [];
    for (let index = 0; index < days.length; index += 7) {
      rows.push(days.slice(index, index + 7));
    }
    return rows;
  }, [days]);
  const metrics = useMemo(() => {
    if (gridWidth <= 0) {
      return {
        cellMinHeight: 56,
        showTodayPill: false,
      };
    }

    const gap = spacing.xs;
    const cellWidth = (gridWidth - gap * 6) / 7;

    return {
      cellMinHeight: Math.max(48, Math.min(60, Math.round(cellWidth * 0.92))),
      showTodayPill: cellWidth >= 66,
    };
  }, [gridWidth]);

  return (
    <View style={styles.wrapper}>
      <View style={styles.weekdayRow}>
        {weekdayLabels.map((label) => (
          <Text key={label} style={styles.weekdayLabel}>
            {label}
          </Text>
        ))}
      </View>

      <View
        onLayout={(event) => setGridWidth(event.nativeEvent.layout.width)}
        style={styles.grid}
      >
        {weeks.map((week, weekIndex) => (
          <View key={`week-${weekIndex}`} style={styles.weekRow}>
            {week.map((day) => (
              <View
                key={day.date}
                style={[
                  styles.cellFrame,
                  { minHeight: metrics.cellMinHeight },
                  day.isSelected ? styles.cellFrameSelected : null,
                ]}
              >
                <Pressable
                  accessibilityLabel={day.accessibilityLabel}
                  accessibilityRole="button"
                  accessibilityState={{ selected: day.isSelected }}
                  onPress={() => onSelectDay(day)}
                  style={[
                    styles.cell,
                    !day.isCurrentMonth ? styles.cellOutsideMonth : null,
                    day.stateKey === "period" ? styles.cellPeriod : null,
                    day.stateKey === "predicted" ? styles.cellPredicted : null,
                    day.stateKey === "pre_fertile" ? styles.cellPreFertile : null,
                    day.stateKey === "fertility_edge" ||
                    day.stateKey === "fertility_peak" ||
                    day.stateKey === "ovulation"
                      ? styles.cellFertile
                      : null,
                    day.stateKey === "fertility_edge" ? styles.cellFertilityEdge : null,
                    day.stateKey === "fertility_peak" ? styles.cellFertilityPeak : null,
                    day.stateKey === "ovulation" ? styles.cellOvulation : null,
                    day.stateKey === "ovulation_tentative"
                      ? styles.cellOvulationTentative
                      : null,
                  ]}
                  testID={`calendar-day-${day.date}`}
                >
                  <View style={styles.cellHeader}>
                    <Text
                      style={[
                        styles.dayLabel,
                        !day.isCurrentMonth ? styles.dayLabelMuted : null,
                        day.isSelected ? styles.dayLabelSelected : null,
                      ]}
                    >
                      {day.label}
                    </Text>
                    {day.isToday && metrics.showTodayPill ? (
                      <View style={styles.todayPill}>
                        <Text style={styles.todayPillText}>{todayLabel}</Text>
                      </View>
                    ) : null}
                  </View>

                  <View style={styles.markers}>
                    {(day.stateKey === "ovulation" ||
                      day.stateKey === "ovulation_tentative") ? (
                      <CalendarStateDecor stateKey={day.stateKey} variant="grid" />
                    ) : null}
                    {day.hasData ? (
                      <View
                        style={styles.dataMarker}
                        testID={`calendar-marker-data-${day.date}`}
                      />
                    ) : null}
                    {day.hasSex ? (
                      <Text
                        style={styles.heartMarker}
                        testID={`calendar-marker-sex-${day.date}`}
                      >
                        ♥
                      </Text>
                    ) : null}
                  </View>
                </Pressable>
              </View>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

const createStyles = (colors: AppThemeColors) =>
  StyleSheet.create({
    wrapper: {
      gap: spacing.xs,
    },
    weekdayRow: {
      flexDirection: "row",
    },
    weekdayLabel: {
      color: colors.textMuted,
      flex: 1,
      fontSize: 9,
      fontWeight: "700",
      textAlign: "center",
      textTransform: "uppercase",
    },
    grid: {
      gap: spacing.xs,
    },
    weekRow: {
      flexDirection: "row",
      gap: spacing.xs,
    },
    cellFrame: {
      borderColor: "transparent",
      borderRadius: 14,
      borderWidth: 2,
      flex: 1,
      padding: 1,
    },
    cellFrameSelected: {
      borderColor: colors.calendarSelectedBorder,
    },
    cell: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 13,
      borderWidth: 1,
      flex: 1,
      gap: 4,
      overflow: "hidden",
      paddingHorizontal: 6,
      paddingVertical: 5,
      position: "relative",
    },
    cellOutsideMonth: {
      opacity: 0.48,
    },
    cellPeriod: {
      backgroundColor: colors.calendarPeriodBg,
      borderColor: colors.calendarPeriodBorder,
    },
    cellPredicted: {
      backgroundColor: colors.calendarPredictedBg,
      borderColor: colors.calendarPredictedBorder,
      borderStyle: "dashed",
    },
    cellPreFertile: {
      backgroundColor: colors.calendarPreFertileBg,
      borderColor: colors.calendarPreFertileBorder,
      borderStyle: "dashed",
    },
    cellFertile: {
      backgroundColor: colors.calendarFertileBg,
      borderColor: colors.calendarFertileBorder,
    },
    cellFertilityEdge: {
      backgroundColor: colors.calendarFertilityEdgeBg,
      borderColor: colors.calendarFertilityEdgeBorder,
    },
    cellFertilityPeak: {
      backgroundColor: colors.calendarFertilityPeakBg,
      borderColor: colors.calendarFertilityPeakBorder,
    },
    cellOvulation: {
      backgroundColor: colors.calendarOvulationBg,
      borderColor: colors.calendarOvulationBorder,
      borderWidth: 2,
    },
    cellOvulationTentative: {
      backgroundColor: colors.calendarTentativeBg,
      borderColor: colors.calendarTentativeBorder,
      borderStyle: "dashed",
    },
    cellHeader: {
      alignItems: "flex-start",
      flexDirection: "row",
      justifyContent: "space-between",
      minHeight: 16,
    },
    dayLabel: {
      color: colors.text,
      fontSize: 12,
      fontWeight: "700",
    },
    dayLabelMuted: {
      color: colors.textMuted,
    },
    dayLabelSelected: {
      color: colors.calendarSelectedBorder,
    },
    todayPill: {
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.border,
      borderRadius: 999,
      borderWidth: 1,
      paddingHorizontal: 4,
      paddingVertical: 1,
    },
    todayPillText: {
      color: colors.textMuted,
      fontSize: 7,
      fontWeight: "700",
    },
    markers: {
      alignItems: "center",
      flexDirection: "row",
      gap: 4,
      justifyContent: "flex-start",
      marginTop: "auto",
      minHeight: 10,
    },
    dataMarker: {
      backgroundColor: colors.calendarDataMarkerBg,
      borderRadius: 999,
      height: 6,
      width: 6,
    },
    heartMarker: {
      color: colors.accentStrong,
      fontSize: 11,
      fontWeight: "700",
    },
  });
