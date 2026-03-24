import { StyleSheet, View } from "react-native";

import type { CalendarDayStateKey } from "../../services/calendar-view-service";
import type { AppThemeColors } from "../theme/tokens";
import { useThemedStyles } from "../theme/useThemedStyles";

type CalendarStateDecorProps = {
  stateKey: CalendarDayStateKey | "neutral";
  variant: "grid" | "legend";
};

export function CalendarStateDecor({
  stateKey,
  variant,
}: CalendarStateDecorProps) {
  const styles = useThemedStyles(createStyles);

  if (stateKey === "ovulation") {
    return (
      <View
        pointerEvents="none"
        style={[
          styles.ovulationMarker,
          variant === "grid" ? styles.ovulationMarkerGrid : styles.ovulationMarkerLegend,
        ]}
      />
    );
  }

  if (stateKey === "ovulation_tentative") {
    return (
      <View
        pointerEvents="none"
        style={[
          styles.ovulationDash,
          variant === "grid" ? styles.ovulationDashGrid : styles.ovulationDashLegend,
        ]}
      />
    );
  }

  return null;
}

const createStyles = (colors: AppThemeColors) =>
  StyleSheet.create({
    ovulationMarker: {
      backgroundColor: colors.calendarOvulationMarkerBg,
      borderRadius: 999,
      shadowColor: colors.calendarOvulationMarkerBg,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.32,
      shadowRadius: 4,
    },
    ovulationMarkerGrid: {
      height: 8,
      width: 8,
    },
    ovulationMarkerLegend: {
      height: 10,
      width: 10,
    },
    ovulationDash: {
      backgroundColor: colors.textMuted,
      borderRadius: 999,
    },
    ovulationDashGrid: {
      height: 3,
      width: 10,
    },
    ovulationDashLegend: {
      height: 3,
      width: 12,
    },
  });
