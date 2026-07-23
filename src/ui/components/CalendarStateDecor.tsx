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

  // Both variants are pure swatches. In the grid the day cell's own
  // accessibility label already names the ovulation state; in the legend the
  // adjacent label does. Either way an unlabelled dot in the reading order is
  // noise, so the decor stays out of the accessibility tree.
  if (stateKey === "ovulation") {
    return (
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
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
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
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
