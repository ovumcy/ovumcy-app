import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { CalendarDayCellViewData } from "../../services/calendar-view-service";
import { colors, spacing } from "../theme/tokens";

type CalendarMonthGridProps = {
  days: CalendarDayCellViewData[];
  onSelectDay: (date: string) => void;
};

const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function CalendarMonthGrid({
  days,
  onSelectDay,
}: CalendarMonthGridProps) {
  const [gridWidth, setGridWidth] = useState(0);
  const metrics = useMemo(() => {
    if (gridWidth <= 0) {
      return {
        cellWidth: undefined,
        cellMinHeight: 68,
        showTodayPill: true,
      };
    }

    const gap = spacing.xs;
    const cellWidth = (gridWidth - gap * 6) / 7;

    return {
      cellWidth,
      cellMinHeight: Math.max(60, Math.min(74, Math.round(cellWidth * 1.08))),
      showTodayPill: cellWidth >= 54,
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
            onPress={() => onSelectDay(day.date)}
            style={[
              styles.cell,
              metrics.cellWidth
                ? {
                    minHeight: metrics.cellMinHeight,
                    width: metrics.cellWidth,
                  }
                : null,
              !day.isCurrentMonth ? styles.cellOutsideMonth : null,
              day.isPeriod ? styles.cellPeriod : null,
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
                <Text style={styles.todayPill}>Today</Text>
              ) : null}
            </View>

            <View style={styles.markers}>
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
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
    backgroundColor: colors.surfaceStrong,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    gap: 5,
    minHeight: 68,
    paddingHorizontal: 6,
    paddingVertical: 5,
  },
  cellOutsideMonth: {
    opacity: 0.48,
  },
  cellPeriod: {
    backgroundColor: colors.accentSoft,
  },
  cellSelected: {
    borderColor: "#487ad1",
    borderWidth: 2,
  },
  cellHeader: {
    alignItems: "flex-start",
    gap: 2,
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
    color: colors.accentStrong,
  },
  todayPill: {
    alignSelf: "flex-start",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    color: colors.textMuted,
    fontSize: 8,
    fontWeight: "700",
    overflow: "hidden",
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  markers: {
    flexDirection: "row",
    gap: 4,
    marginTop: "auto",
  },
  dataMarker: {
    backgroundColor: colors.accentStrong,
    borderRadius: 999,
    height: 7,
    width: 7,
  },
  heartMarker: {
    color: colors.accentStrong,
    fontSize: 12,
    fontWeight: "700",
  },
});
