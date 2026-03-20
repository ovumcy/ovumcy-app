import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { CalendarDayCellViewData } from "../../services/calendar-view-service";
import type { AppThemeColors } from "../theme/tokens";
import { spacing } from "../theme/tokens";
import { useThemedStyles } from "../theme/useThemedStyles";

type CalendarMonthGridProps = {
  days: CalendarDayCellViewData[];
  onSelectDay: (day: CalendarDayCellViewData) => void;
  todayLabel: string;
};

const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function CalendarMonthGrid({
  days,
  onSelectDay,
  todayLabel,
}: CalendarMonthGridProps) {
  const styles = useThemedStyles(createStyles);
  const [gridWidth, setGridWidth] = useState(0);
  const metrics = useMemo(() => {
    if (gridWidth <= 0) {
      return {
        cellWidth: undefined,
        cellMinHeight: 76,
        showTodayPill: true,
      };
    }

    const gap = spacing.xs;
    const cellWidth = (gridWidth - gap * 6) / 7;

    return {
      cellWidth,
      cellMinHeight: Math.max(70, Math.min(84, Math.round(cellWidth * 1.08))),
      showTodayPill: cellWidth >= 58,
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
        {days.map((day) => (
          <Pressable
            key={day.date}
            accessibilityRole="button"
            onPress={() => onSelectDay(day)}
            style={[
              styles.cell,
              metrics.cellWidth
                ? {
                    minHeight: metrics.cellMinHeight,
                    width: metrics.cellWidth,
                  }
                : null,
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
              day.isSelected ? styles.cellSelected : null,
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
              {day.hasData ? (
                <View
                  style={styles.dataMarker}
                  testID={`calendar-marker-data-${day.date}`}
                />
              ) : null}
              {day.hasOvulationMarker ? (
                <View
                  style={styles.ovulationMarker}
                  testID={`calendar-marker-ovulation-${day.date}`}
                />
              ) : null}
              {day.hasTentativeOvulationMarker ? (
                <View
                  style={styles.ovulationDash}
                  testID={`calendar-marker-ovulation-tentative-${day.date}`}
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
        ))}
      </View>
    </View>
  );
}

const createStyles = (colors: AppThemeColors) =>
  StyleSheet.create({
    wrapper: {
      gap: spacing.sm,
    },
    weekdayRow: {
      flexDirection: "row",
    },
    weekdayLabel: {
      color: colors.textMuted,
      flex: 1,
      fontSize: 10,
      fontWeight: "700",
      textAlign: "center",
      textTransform: "uppercase",
    },
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.xs,
    },
    cell: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 14,
      borderWidth: 1,
      gap: 6,
      minHeight: 76,
      paddingHorizontal: 8,
      paddingVertical: 7,
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
      borderColor: colors.calendarFertilityPeakBorder,
    },
    cellOvulationTentative: {
      backgroundColor: colors.calendarTentativeBg,
      borderColor: colors.calendarTentativeBorder,
      borderStyle: "dashed",
    },
    cellSelected: {
      borderColor: colors.calendarSelectedBorder,
      borderWidth: 2,
    },
    cellHeader: {
      alignItems: "flex-start",
      flexDirection: "row",
      justifyContent: "space-between",
      minHeight: 20,
    },
    dayLabel: {
      color: colors.text,
      fontSize: 13,
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
      paddingHorizontal: 5,
      paddingVertical: 1,
    },
    todayPillText: {
      color: colors.textMuted,
      fontSize: 8,
      fontWeight: "700",
    },
    markers: {
      alignItems: "center",
      flexDirection: "row",
      gap: 4,
      marginTop: "auto",
    },
    dataMarker: {
      backgroundColor: colors.calendarDataMarkerBg,
      borderRadius: 999,
      height: 7,
      width: 7,
    },
    ovulationMarker: {
      backgroundColor: colors.calendarOvulationMarkerBg,
      borderRadius: 999,
      height: 9,
      width: 9,
    },
    ovulationDash: {
      backgroundColor: colors.calendarOvulationDashBg,
      borderRadius: 999,
      height: 3,
      width: 12,
    },
    heartMarker: {
      color: colors.accentStrong,
      fontSize: 12,
      fontWeight: "700",
    },
  });
