import { useMemo } from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

import type { DashboardCycleHeroViewData } from "../../../services/dashboard-view-service";
import type { AppThemeColors } from "../../theme/tokens";
import { spacing } from "../../theme/tokens";
import { useThemedStyles } from "../../theme/useThemedStyles";

type DashboardCycleHeroProps = {
  viewData: DashboardCycleHeroViewData;
};

const HERO_CURRENT_DOT_SIZE = 16;
const HERO_RING_STROKE_WIDTH = 11;
const HERO_OVULATION_MARKER_SIZE = 16;
const HERO_OVULATION_MARKER_CORE_SIZE = 6;

export function DashboardCycleHero({ viewData }: DashboardCycleHeroProps) {
  const styles = useThemedStyles(createStyles);
  const { width } = useWindowDimensions();
  const heroSize = width >= 420 ? 244 : 220;
  const phaseRingRadius = heroSize / 2 - 28;
  const centerSize = heroSize - 88;
  const emphasizedPhaseLabel = resolveEmphasizedPhaseLabel(viewData);
  const phaseRingPaths = useMemo(
    () =>
      viewData.phaseSegments.reduce<
        {
          d: string;
          key: DashboardCycleHeroViewData["phaseSegments"][number]["key"];
          tone: DashboardCycleHeroViewData["phaseSegments"][number]["tone"];
        }[]
      >((paths, segment) => {
        const d = buildArcPath(
          segment.startPercent,
          segment.endPercent,
          phaseRingRadius,
          heroSize,
        );
        if (!d) {
          return paths;
        }

        paths.push({
          d,
          key: segment.key,
          tone: segment.tone,
        });
        return paths;
      }, []),
    [heroSize, phaseRingRadius, viewData.phaseSegments],
  );
  const ringTrackColor = resolveRingTrackColor(styles);
  const ovulationMarkerPercent = resolveOvulationMarkerPercent(
    viewData.phaseSegments,
    viewData.currentTone,
  );

  return (
    <View
      accessibilityLabel={buildDashboardCycleHeroAccessibilityLabel(viewData)}
      accessible
      style={styles.card}
      testID="dashboard-cycle-hero"
    >
      <View style={styles.glowPrimary} />
      <View style={styles.glowSecondary} />

      <View style={[styles.ringShell, { height: heroSize, width: heroSize }]}>
        <Svg
          height={heroSize}
          style={styles.ringSvg}
          viewBox={`0 0 ${heroSize} ${heroSize}`}
          width={heroSize}
        >
          <Circle
            cx={heroSize / 2}
            cy={heroSize / 2}
            fill="none"
            opacity={0.58}
            r={phaseRingRadius}
            stroke={ringTrackColor}
            strokeWidth={HERO_RING_STROKE_WIDTH}
          />
          {phaseRingPaths.map((segment) => (
            <Path
              d={segment.d}
              fill="none"
              key={segment.key}
              stroke={resolveArcStrokeColor(styles, segment.tone)}
              strokeLinecap="round"
              strokeWidth={HERO_RING_STROKE_WIDTH}
            />
          ))}
        </Svg>
        {viewData.progressPercent !== null ? (
          <View
            style={[
              styles.currentDot,
              resolveCurrentDotStyle(styles, viewData.currentTone),
              resolveCircularPosition(
                viewData.progressPercent,
                phaseRingRadius,
                heroSize,
                HERO_CURRENT_DOT_SIZE,
                HERO_CURRENT_DOT_SIZE,
              ),
            ]}
          />
        ) : null}
        {ovulationMarkerPercent !== null ? (
          <View
            pointerEvents="none"
            style={[
              styles.ovulationMarkerShell,
              resolveCircularPosition(
                ovulationMarkerPercent,
                phaseRingRadius,
                heroSize,
                HERO_OVULATION_MARKER_SIZE,
                HERO_OVULATION_MARKER_SIZE,
              ),
            ]}
            testID="dashboard-cycle-hero-ovulation-marker"
          >
            <View style={styles.ovulationMarkerOuter}>
              <View style={styles.ovulationMarkerCore} />
            </View>
          </View>
        ) : null}
        <View
          style={[
            styles.centerCard,
            {
              borderRadius: centerSize / 2,
              height: centerSize,
              width: centerSize,
            },
          ]}
        >
          <Text
            adjustsFontSizeToFit
            minimumFontScale={0.85}
            numberOfLines={1}
            style={styles.centerTitle}
            testID="dashboard-cycle-hero-title"
          >
            {viewData.title}
          </Text>
          <Text style={styles.centerValue} testID="dashboard-cycle-hero-value">
            {viewData.value}
          </Text>
          {emphasizedPhaseLabel ? (
            <Text
              style={[
                styles.centerPhaseLabel,
                viewData.currentTone === "ovulation"
                  ? styles.centerPhaseLabelOvulation
                  : styles.centerPhaseLabelPeriod,
              ]}
            >
              {emphasizedPhaseLabel}
            </Text>
          ) : null}
          <Text style={styles.centerDetail} testID="dashboard-cycle-hero-detail">
            {viewData.detail}
          </Text>
        </View>
      </View>

      {viewData.phaseCards.length > 0 ? (
        <View style={styles.phaseGrid} testID="dashboard-cycle-hero-phase-grid">
          {viewData.phaseCards.map((phaseCard) => (
            <View
              key={phaseCard.key}
              style={[
                styles.phaseCard,
                resolvePhaseCardStyle(styles, phaseCard.tone),
                phaseCard.active ? styles.phaseCardActive : null,
                phaseCard.active && phaseCard.tone === "ovulation"
                  ? styles.phaseCardActiveOvulation
                  : null,
              ]}
              accessibilityState={{ selected: phaseCard.active }}
              testID={`dashboard-cycle-hero-phase-card-${phaseCard.key}`}
            >
              <View style={styles.phaseCardHeader}>
                <View style={resolvePhaseDotStyle(styles, phaseCard.tone)} />
                <Text
                  adjustsFontSizeToFit
                  minimumFontScale={0.85}
                  numberOfLines={1}
                  style={[
                    styles.phaseCardLabel,
                    phaseCard.tone === "ovulation" ? styles.phaseCardLabelOvulation : null,
                  ]}
                >
                  {phaseCard.label}
                </Text>
              </View>
              <Text style={styles.phaseCardRange}>{phaseCard.rangeLabel}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {viewData.caption ? (
        <Text style={styles.caption} testID="dashboard-cycle-hero-caption">
          {viewData.caption}
        </Text>
      ) : null}

      {viewData.upcomingOvulationLabel ? (
        <Text
          style={styles.caption}
          testID="dashboard-cycle-hero-upcoming-ovulation"
        >
          {viewData.upcomingOvulationLabel}
        </Text>
      ) : null}
    </View>
  );
}

function buildDashboardCycleHeroAccessibilityLabel(
  viewData: DashboardCycleHeroViewData,
): string {
  const activePhase = viewData.phaseCards.find((phaseCard) => phaseCard.active)?.label ?? "";

  return [
    `${viewData.title} ${viewData.value}`,
    activePhase,
    viewData.detail,
    viewData.caption,
    viewData.upcomingOvulationLabel ?? "",
  ]
    .filter((value) => value.trim().length > 0)
    .join(". ");
}

function resolveCircularPosition(
  percent: number,
  radius: number,
  containerSize: number,
  width: number,
  height: number,
) {
  const angle = percent * Math.PI * 2 - Math.PI / 2;
  const center = containerSize / 2;

  return {
    left: center + Math.cos(angle) * radius - width / 2,
    top: center + Math.sin(angle) * radius - height / 2,
  };
}

function buildArcPath(
  startPercent: number,
  endPercent: number,
  radius: number,
  containerSize: number,
) {
  if (endPercent <= startPercent + 0.0001) {
    return null;
  }

  const start = resolveArcPoint(startPercent, radius, containerSize);
  const end = resolveArcPoint(endPercent, radius, containerSize);
  const largeArcFlag = endPercent - startPercent > 0.5 ? 1 : 0;

  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`;
}

function resolveArcPoint(percent: number, radius: number, containerSize: number) {
  const angle = percent * Math.PI * 2 - Math.PI / 2;
  const center = containerSize / 2;

  return {
    x: center + Math.cos(angle) * radius,
    y: center + Math.sin(angle) * radius,
  };
}

function resolveArcStrokeColor(
  styles: ReturnType<typeof createStyles>,
  tone: DashboardCycleHeroViewData["phaseSegments"][number]["tone"],
) {
  switch (tone) {
    case "period":
      return String(StyleSheet.flatten(styles.phaseSegmentPeriod)?.backgroundColor);
    case "follicular":
      return String(StyleSheet.flatten(styles.phaseSegmentFollicular)?.backgroundColor);
    case "ovulation":
      return String(StyleSheet.flatten(styles.phaseSegmentOvulation)?.backgroundColor);
    default:
      return String(StyleSheet.flatten(styles.phaseSegmentLuteal)?.backgroundColor);
  }
}

function resolveRingTrackColor(styles: ReturnType<typeof createStyles>) {
  return String(StyleSheet.flatten(styles.ringTrackStroke)?.borderColor);
}

function resolveCurrentDotStyle(
  styles: ReturnType<typeof createStyles>,
  tone: DashboardCycleHeroViewData["currentTone"],
) {
  switch (tone) {
    case "period":
      return styles.currentDotPeriod;
    case "follicular":
      return styles.currentDotFollicular;
    case "ovulation":
      return styles.currentDotOvulation;
    case "luteal":
      return styles.currentDotLuteal;
    default:
      return styles.currentDotNeutral;
  }
}

function resolvePhaseCardStyle(
  styles: ReturnType<typeof createStyles>,
  tone: DashboardCycleHeroViewData["phaseCards"][number]["tone"],
) {
  switch (tone) {
    case "period":
      return styles.phaseCardPeriod;
    case "follicular":
      return styles.phaseCardFollicular;
    case "ovulation":
      return styles.phaseCardOvulation;
    default:
      return styles.phaseCardLuteal;
  }
}

function resolvePhaseDotStyle(
  styles: ReturnType<typeof createStyles>,
  tone: DashboardCycleHeroViewData["phaseCards"][number]["tone"],
) {
  switch (tone) {
    case "period":
      return styles.phaseDotPeriod;
    case "follicular":
      return styles.phaseDotFollicular;
    case "ovulation":
      return styles.phaseDotOvulation;
    default:
      return styles.phaseDotLuteal;
  }
}

function resolveEmphasizedPhaseLabel(viewData: DashboardCycleHeroViewData): string | null {
  if (viewData.currentTone !== "period" && viewData.currentTone !== "ovulation") {
    return null;
  }

  const activePhase = viewData.phaseCards.find((phaseCard) => phaseCard.active);
  return activePhase?.label ?? null;
}

function resolveOvulationMarkerPercent(
  phaseSegments: DashboardCycleHeroViewData["phaseSegments"],
  currentTone: DashboardCycleHeroViewData["currentTone"],
): number | null {
  if (currentTone === "ovulation") {
    return null;
  }

  const ovulationSegment = phaseSegments.find(
    (segment) => segment.key === "ovulation",
  );

  if (!ovulationSegment) {
    return null;
  }

  return Math.max(
    0,
    Math.min(
      1,
    (ovulationSegment.startPercent + ovulationSegment.endPercent) / 2,
    ),
  );
}

const createStyles = (colors: AppThemeColors) =>
  StyleSheet.create({
    card: {
      alignItems: "center",
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.lineSoft,
      borderRadius: 28,
      borderWidth: 1,
      gap: spacing.md,
      overflow: "hidden",
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.lg,
      position: "relative",
      shadowColor: colors.shadowStrong,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.38,
      shadowRadius: 16,
    },
    glowPrimary: {
      backgroundColor: colors.bgGlowPrimary,
      borderRadius: 999,
      height: 112,
      opacity: 0.45,
      position: "absolute",
      right: -24,
      top: -20,
      width: 112,
    },
    glowSecondary: {
      backgroundColor: colors.bgGlowSecondary,
      borderRadius: 999,
      height: 96,
      left: -30,
      opacity: 0.4,
      position: "absolute",
      top: 46,
      width: 96,
    },
    ringShell: {
      alignItems: "center",
      justifyContent: "center",
      position: "relative",
    },
    ringSvg: {
      position: "absolute",
    },
    ringTrackStroke: {
      borderColor: colors.lineSoft,
    },
    phaseSegmentPeriod: {
      backgroundColor: colors.calendarPeriodBorder,
    },
    phaseSegmentFollicular: {
      backgroundColor: colors.calendarPredictedBorder,
    },
    phaseSegmentOvulation: {
      backgroundColor: colors.calendarOvulationBorder,
    },
    phaseSegmentLuteal: {
      backgroundColor: colors.calendarFertilityEdgeBorder,
    },
    currentDot: {
      backgroundColor: colors.surface,
      borderRadius: 999,
      borderWidth: 3,
      height: HERO_CURRENT_DOT_SIZE,
      position: "absolute",
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.16,
      shadowRadius: 8,
      width: HERO_CURRENT_DOT_SIZE,
    },
    currentDotNeutral: {
      borderColor: colors.textMuted,
      shadowColor: colors.textMuted,
    },
    currentDotPeriod: {
      borderColor: colors.calendarPeriodBorder,
      shadowColor: colors.calendarPeriodBorder,
    },
    currentDotFollicular: {
      borderColor: colors.calendarPredictedBorder,
      shadowColor: colors.calendarPredictedBorder,
    },
    currentDotOvulation: {
      borderColor: colors.calendarOvulationBorder,
      shadowColor: colors.calendarOvulationBorder,
    },
    currentDotLuteal: {
      borderColor: colors.calendarFertilityEdgeBorder,
      shadowColor: colors.calendarFertilityEdgeBorder,
    },
    ovulationMarkerShell: {
      alignItems: "center",
      height: HERO_OVULATION_MARKER_SIZE,
      justifyContent: "center",
      position: "absolute",
      width: HERO_OVULATION_MARKER_SIZE,
    },
    ovulationMarkerOuter: {
      alignItems: "center",
      backgroundColor: colors.calendarOvulationMarkerBg,
      borderColor: colors.surface,
      borderRadius: 999,
      borderWidth: 2,
      height: HERO_OVULATION_MARKER_SIZE,
      justifyContent: "center",
      shadowColor: colors.calendarOvulationMarkerBg,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.34,
      shadowRadius: 6,
      width: HERO_OVULATION_MARKER_SIZE,
    },
    ovulationMarkerCore: {
      backgroundColor: colors.surface,
      borderRadius: 999,
      height: HERO_OVULATION_MARKER_CORE_SIZE,
      width: HERO_OVULATION_MARKER_CORE_SIZE,
    },
    centerCard: {
      alignItems: "center",
      backgroundColor: "transparent",
      borderWidth: 0,
      gap: 2,
      justifyContent: "center",
      paddingHorizontal: spacing.md,
    },
    centerTitle: {
      color: colors.accentStrong,
      fontSize: 13,
      fontWeight: "400",
      textAlign: "center",
    },
    centerValue: {
      color: colors.text,
      fontSize: 42,
      fontWeight: "400",
      lineHeight: 42,
      marginTop: 2,
      textAlign: "center",
    },
    centerPhaseLabel: {
      fontSize: 12,
      fontWeight: "500",
      marginTop: 2,
      textAlign: "center",
    },
    centerPhaseLabelPeriod: {
      color: colors.calendarPeriodBorder,
    },
    centerPhaseLabelOvulation: {
      color: colors.calendarOvulationBorder,
    },
    centerDetail: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: "400",
      marginTop: 2,
      textAlign: "center",
    },
    phaseGrid: {
      alignSelf: "center",
      columnGap: 10,
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
      maxWidth: 304,
      rowGap: 10,
      width: "100%",
    },
    phaseCard: {
      borderRadius: 16,
      borderWidth: 1,
      justifyContent: "space-between",
      minHeight: 80,
      opacity: 0.72,
      paddingHorizontal: 12,
      paddingVertical: 9,
      width: "48.25%",
    },
    phaseCardActive: {
      opacity: 1,
      shadowColor: colors.shadowSoft,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.16,
      shadowRadius: 8,
    },
    phaseCardActiveOvulation: {
      shadowColor: colors.calendarOvulationMarkerBg,
      shadowOpacity: 0.24,
      shadowRadius: 10,
    },
    phaseCardPeriod: {
      backgroundColor: colors.calendarPeriodBg,
      borderColor: "rgba(199, 117, 109, 0.18)",
    },
    phaseCardFollicular: {
      backgroundColor: colors.calendarPreFertileBg,
      borderColor: "rgba(145, 108, 67, 0.16)",
    },
    phaseCardOvulation: {
      backgroundColor: colors.surfaceStrong,
      borderColor: colors.calendarOvulationBorder,
      borderWidth: 1.5,
    },
    phaseCardLuteal: {
      backgroundColor: colors.calendarFertileBg,
      borderColor: "rgba(126, 157, 103, 0.18)",
    },
    phaseCardHeader: {
      alignItems: "center",
      flexDirection: "row",
      gap: 6,
    },
    phaseDotPeriod: {
      backgroundColor: colors.calendarPeriodBorder,
      borderRadius: 999,
      height: 8,
      width: 8,
    },
    phaseDotFollicular: {
      backgroundColor: colors.calendarPredictedBorder,
      borderRadius: 999,
      height: 8,
      width: 8,
    },
    phaseDotOvulation: {
      backgroundColor: colors.calendarOvulationMarkerBg,
      borderColor: colors.calendarOvulationBorder,
      borderRadius: 999,
      borderWidth: 2,
      height: 12,
      width: 12,
    },
    phaseDotLuteal: {
      backgroundColor: colors.calendarFertilityEdgeBorder,
      borderRadius: 999,
      height: 8,
      width: 8,
    },
    phaseCardLabel: {
      color: colors.text,
      flexShrink: 1,
      fontSize: 13,
      fontWeight: "500",
    },
    phaseCardLabelOvulation: {
      color: colors.calendarOvulationBorder,
    },
    phaseCardRange: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: "400",
      paddingLeft: 14,
    },
    caption: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "500",
      textAlign: "center",
    },
  });
