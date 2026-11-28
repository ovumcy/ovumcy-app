import { StyleSheet, Text, View, type DimensionValue } from "react-native";

import type {
  CycleRibbonCellFlags,
  CycleRibbonPhase,
  DashboardCycleRibbonViewData,
} from "../../../services/dashboard-cycle-ribbon-service";
import type { AppThemeColors } from "../../theme/tokens";
import { fontScale, spacing } from "../../theme/tokens";
import { useThemedStyles } from "../../theme/useThemedStyles";

type DashboardCycleRibbonProps = {
  viewData: DashboardCycleRibbonViewData;
};

type Align = "start" | "center" | "end";

const AXIS_LABEL_WIDTH = 96;

// The hero card is one accessible element whose label already carries the
// ribbon summary, so nothing here is read on its own.
export function DashboardCycleRibbon({ viewData }: DashboardCycleRibbonProps) {
  const styles = useThemedStyles(createStyles);
  const axisDays = viewData.days.length;

  return (
    <View style={styles.root} testID="dashboard-cycle-ribbon">
      <View style={styles.axisRow}>
        <Text
          maxFontSizeMultiplier={fontScale.dense}
          numberOfLines={1}
          style={[
            styles.todayLabel,
            axisLabelPosition(viewData.todayDay, axisDays, viewData.todayMarkerAlign),
          ]}
          testID="dashboard-cycle-ribbon-today-marker"
        >
          {viewData.todayLabel}
        </Text>
      </View>

      <View style={styles.cells}>
        {viewData.days.map((day) => (
          <View
            key={day.day}
            style={[
              styles.cell,
              { backgroundColor: phaseFill(styles, day.phase) },
              day.isPredictedFlow ? styles.predictedFlow : null,
              day.isToday ? styles.todayCell : null,
            ]}
            testID={`dashboard-cycle-ribbon-day-${String(day.day)}`}
          >
            <CellOverlays flags={day} styles={styles} />
          </View>
        ))}
      </View>

      <View style={styles.axisRow}>
        {viewData.days
          .filter((day) => day.showScaleLabel)
          .map((day) => (
            <Text
              key={day.day}
              maxFontSizeMultiplier={fontScale.dense}
              numberOfLines={1}
              style={[
                styles.scaleLabel,
                day.isToday ? styles.scaleLabelToday : null,
                axisLabelPosition(
                  day.day,
                  axisDays,
                  // Besides today only day 1 and the last day carry a number.
                  day.isToday ? viewData.todayMarkerAlign : day.day === 1 ? "start" : "end",
                ),
              ]}
              testID={`dashboard-cycle-ribbon-scale-${String(day.day)}`}
            >
              {String(day.day)}
            </Text>
          ))}
      </View>

      <View style={styles.legend} testID="dashboard-cycle-ribbon-legend">
        {viewData.legend.map((item) => (
          <View
            key={item.key}
            style={styles.legendItem}
            testID={`dashboard-cycle-ribbon-legend-${item.key}`}
          >
            {item.swatches.map((flags, index) => (
              <Swatch flags={flags} key={`${item.key}-${String(index)}`} styles={styles} />
            ))}
            <Text maxFontSizeMultiplier={fontScale.dense} style={styles.legendLabel}>
              {item.label}
            </Text>
          </View>
        ))}
      </View>

      {viewData.truncatedNote ? (
        <Text style={styles.note} testID="dashboard-cycle-ribbon-truncated">
          {viewData.truncatedNote}
        </Text>
      ) : null}
    </View>
  );
}

function CellOverlays({
  flags,
  styles,
}: {
  flags: CycleRibbonCellFlags;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <>
      {flags.isStartWindow ? <View style={styles.startWindow} /> : null}
      {flags.isLogged ? <View style={styles.loggedStrip} /> : null}
      {flags.isFertile ? (
        <View style={flags.isFertilePeak ? styles.fertilePeakStrip : styles.fertileStrip} />
      ) : null}
    </>
  );
}

function Swatch({
  flags,
  styles,
}: {
  flags: CycleRibbonCellFlags;
  styles: ReturnType<typeof createStyles>;
}) {
  if (flags.phase === "beyond" && (flags.isFertile || flags.isLogged)) {
    return (
      <View style={[styles.swatchStrip, flags.isFertile ? styles.fertileFill : styles.loggedFill]} />
    );
  }
  return (
    <View
      style={[
        styles.swatch,
        { backgroundColor: phaseFill(styles, flags.phase) },
        flags.isPredictedFlow ? styles.predictedFlow : null,
      ]}
    >
      {flags.isStartWindow ? <View style={styles.startWindow} /> : null}
    </View>
  );
}

// Labels sit in their own row, placed by percentage so a word wider than its
// day cell is not clipped: pinned left near day 1, right near the last day,
// centred on the cell otherwise.
function axisLabelPosition(day: number, axisDays: number, align: Align) {
  const percent = (value: number): DimensionValue => `${String((value / axisDays) * 100)}%`;
  if (align === "start") {
    return { left: percent(day - 1), textAlign: "left" as const };
  }
  if (align === "end") {
    return { right: percent(axisDays - day), textAlign: "right" as const };
  }
  return {
    left: percent(day - 0.5),
    marginLeft: -AXIS_LABEL_WIDTH / 2,
    textAlign: "center" as const,
    width: AXIS_LABEL_WIDTH,
  };
}

function phaseFill(styles: ReturnType<typeof createStyles>, phase: CycleRibbonPhase): string {
  switch (phase) {
    case "menstrual":
      return String(StyleSheet.flatten(styles.phaseMenstrual)?.backgroundColor);
    case "follicular":
      return String(StyleSheet.flatten(styles.phaseFollicular)?.backgroundColor);
    case "ovulation":
      return String(StyleSheet.flatten(styles.phaseOvulation)?.backgroundColor);
    case "luteal":
      return String(StyleSheet.flatten(styles.phaseLuteal)?.backgroundColor);
    case "withheld":
      return String(StyleSheet.flatten(styles.phaseWithheld)?.backgroundColor);
    case "beyond":
      return "transparent";
  }
}

const createStyles = (colors: AppThemeColors) =>
  StyleSheet.create({
    root: {
      alignSelf: "stretch",
      gap: 4,
    },
    axisRow: {
      height: 18,
      position: "relative",
    },
    todayLabel: {
      color: colors.text,
      fontSize: 12,
      fontWeight: "700",
      position: "absolute",
      top: 0,
    },
    scaleLabel: {
      color: colors.textMuted,
      fontSize: 12,
      fontVariant: ["tabular-nums"],
      position: "absolute",
      top: 0,
    },
    scaleLabelToday: {
      color: colors.text,
      fontWeight: "700",
    },
    cells: {
      backgroundColor: colors.surfaceMuted,
      borderRadius: 4,
      flexDirection: "row",
      gap: 1,
      height: 32,
      overflow: "hidden",
    },
    cell: {
      flex: 1,
      position: "relative",
    },
    todayCell: {
      borderColor: colors.text,
      borderWidth: 2,
    },
    // Estimated days read lighter than recorded ones.
    predictedFlow: {
      opacity: 0.45,
    },
    startWindow: {
      bottom: 0,
      left: 0,
      position: "absolute",
      right: 0,
      top: 0,
      backgroundColor: colors.text,
      opacity: 0.28,
    },
    loggedStrip: {
      backgroundColor: colors.text,
      height: 4,
      left: 0,
      position: "absolute",
      right: 0,
      top: 0,
    },
    fertileStrip: {
      backgroundColor: colors.ribbonFertile,
      bottom: 0,
      height: 6,
      left: 0,
      position: "absolute",
      right: 0,
    },
    fertilePeakStrip: {
      backgroundColor: colors.ribbonFertilePeak,
      bottom: 0,
      height: 8,
      left: 0,
      position: "absolute",
      right: 0,
    },
    legend: {
      columnGap: spacing.md,
      flexDirection: "row",
      flexWrap: "wrap",
      rowGap: spacing.xs,
    },
    legendItem: {
      alignItems: "center",
      flexDirection: "row",
      gap: 4,
    },
    legendLabel: {
      color: colors.textMuted,
      fontSize: 12,
    },
    swatch: {
      borderColor: colors.lineSoft,
      borderRadius: 3,
      borderWidth: 1,
      height: 14,
      overflow: "hidden",
      width: 20,
    },
    swatchStrip: {
      borderRadius: 2,
      height: 6,
      width: 20,
    },
    fertileFill: {
      backgroundColor: colors.ribbonFertile,
    },
    loggedFill: {
      backgroundColor: colors.text,
    },
    note: {
      color: colors.textMuted,
      fontSize: 12,
    },
    phaseMenstrual: {
      backgroundColor: colors.ribbonMenstrual,
    },
    phaseFollicular: {
      backgroundColor: colors.ribbonFollicular,
    },
    phaseOvulation: {
      backgroundColor: colors.ribbonOvulation,
    },
    phaseLuteal: {
      backgroundColor: colors.ribbonLuteal,
    },
    phaseWithheld: {
      backgroundColor: colors.ribbonWithheld,
    },
  });
