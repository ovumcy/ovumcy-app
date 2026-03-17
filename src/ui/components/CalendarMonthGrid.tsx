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
  return (
    <View style={styles.wrapper}>
      <View style={styles.weekdayRow}>
        {weekdayLabels.map((label) => (
          <Text key={label} style={styles.weekdayLabel}>
            {label}
          </Text>
        ))}
      </View>

      <View style={styles.grid}>
        {days.map((day) => (
          <Pressable
            key={day.date}
            accessibilityRole="button"
            onPress={() => onSelectDay(day.date)}
            style={[
              styles.cell,
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
              {day.isToday ? <Text style={styles.todayPill}>Today</Text> : null}
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
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
    textTransform: "uppercase",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  cell: {
    backgroundColor: colors.surfaceStrong,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    flexBasis: "13.8%",
    gap: spacing.xs,
    minHeight: 72,
    padding: spacing.sm,
  },
  cellOutsideMonth: {
    opacity: 0.48,
  },
  cellPeriod: {
    backgroundColor: colors.accentSoft,
  },
  cellSelected: {
    borderColor: colors.accentStrong,
    borderWidth: 2,
  },
  cellHeader: {
    gap: 4,
  },
  dayLabel: {
    color: colors.text,
    fontSize: 15,
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
    fontSize: 10,
    fontWeight: "700",
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  markers: {
    flexDirection: "row",
    gap: 6,
    marginTop: "auto",
  },
  dataMarker: {
    backgroundColor: colors.accentStrong,
    borderRadius: 999,
    height: 8,
    width: 8,
  },
  heartMarker: {
    color: colors.accentStrong,
    fontSize: 12,
    fontWeight: "700",
  },
});
