import { useMemo } from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";

import type { DashboardCycleHeroViewData } from "../../../services/dashboard-view-service";
import type { AppThemeColors } from "../../theme/tokens";
import { spacing } from "../../theme/tokens";
import { useThemedStyles } from "../../theme/useThemedStyles";

type DashboardCycleHeroProps = {
  viewData: DashboardCycleHeroViewData;
};

const HERO_TICK_COUNT = 20;

export function DashboardCycleHero({ viewData }: DashboardCycleHeroProps) {
  const styles = useThemedStyles(createStyles);
  const { width } = useWindowDimensions();
  const heroSize = width >= 420 ? 228 : 196;
  const ringRadius = heroSize / 2 - 22;
  const trackSize = heroSize - 28;
  const centerSize = heroSize - 84;
  const currentDotPosition = viewData.progressPercent ?? null;
  const tickPositions = useMemo(
    () =>
      Array.from({ length: HERO_TICK_COUNT }).map((_, index) => {
        const percent = index / (HERO_TICK_COUNT - 1);
        return {
          key: `tick-${String(index)}`,
          percent,
          ...resolveCircularPosition(percent, ringRadius, heroSize, 8),
          filled:
            viewData.progressPercent !== null &&
            percent <= viewData.progressPercent + 0.0001,
        };
      }),
    [heroSize, ringRadius, viewData.progressPercent],
  );

  return (
    <View style={styles.card} testID="dashboard-cycle-hero">
      <View style={styles.glowPrimary} />
      <View style={styles.glowSecondary} />
      <View style={[styles.ringShell, { height: heroSize, width: heroSize }]}>
        <View
          style={[
            styles.ringTrack,
            { borderRadius: trackSize / 2, height: trackSize, width: trackSize },
          ]}
        />
        {tickPositions.map((tick) => (
          <View
            key={tick.key}
            style={[
              styles.tick,
              tick.filled ? styles.tickFilled : null,
              {
                left: tick.left,
                top: tick.top,
              },
            ]}
          />
        ))}
        {viewData.markers.map((marker) => (
          <View
            key={marker.key}
            style={[
              styles.marker,
              resolveMarkerStyle(styles, marker.tone),
              resolveCircularPosition(marker.offsetPercent, ringRadius, heroSize, 12),
            ]}
            testID={`dashboard-cycle-hero-marker-${marker.key}`}
          />
        ))}
        {currentDotPosition !== null ? (
          <View
            style={[
              styles.currentDot,
              resolveCurrentDotStyle(styles, viewData.state),
              resolveCircularPosition(currentDotPosition, ringRadius, heroSize, 14),
            ]}
          />
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
          <Text style={styles.centerIcon}>{viewData.icon}</Text>
          <Text style={styles.centerTitle} testID="dashboard-cycle-hero-title">
            {viewData.title}
          </Text>
          <Text style={styles.centerValue} testID="dashboard-cycle-hero-value">
            {viewData.value}
          </Text>
          <Text style={styles.centerDetail} testID="dashboard-cycle-hero-detail">
            {viewData.detail}
          </Text>
        </View>
      </View>

      {viewData.caption ? (
        <Text style={styles.caption} testID="dashboard-cycle-hero-caption">
          {viewData.caption}
        </Text>
      ) : null}

      {viewData.markers.length > 0 ? (
        <View style={styles.legendRow}>
          {viewData.markers.map((marker) => (
            <View key={marker.key} style={styles.legendItem}>
              <View style={[styles.legendDot, resolveMarkerStyle(styles, marker.tone)]} />
              <Text style={styles.legendText}>{marker.label}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function resolveCircularPosition(
  percent: number,
  radius: number,
  containerSize: number,
  size: number,
) {
  const angle = percent * Math.PI * 2 - Math.PI / 2;
  const center = containerSize / 2;

  return {
    left: center + Math.cos(angle) * radius - size / 2,
    top: center + Math.sin(angle) * radius - size / 2,
  };
}

function resolveMarkerStyle(
  styles: ReturnType<typeof createStyles>,
  tone: DashboardCycleHeroViewData["markers"][number]["tone"],
) {
  switch (tone) {
    case "fertile":
      return styles.markerFertile;
    case "ovulation":
      return styles.markerOvulation;
    default:
      return styles.markerPeriod;
  }
}

function resolveCurrentDotStyle(
  styles: ReturnType<typeof createStyles>,
  state: DashboardCycleHeroViewData["state"],
) {
  return state === "approximate" ? styles.currentDotApproximate : styles.currentDotActive;
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
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.82,
      shadowRadius: 24,
    },
    glowPrimary: {
      backgroundColor: colors.bgGlowPrimary,
      borderRadius: 999,
      height: 112,
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
      position: "absolute",
      top: 46,
      width: 96,
    },
    ringShell: {
      alignItems: "center",
      justifyContent: "center",
      position: "relative",
    },
    ringTrack: {
      borderColor: colors.lineSoft,
      borderWidth: 1,
      position: "absolute",
    },
    tick: {
      backgroundColor: colors.surfaceMuted,
      borderRadius: 999,
      height: 8,
      opacity: 0.92,
      position: "absolute",
      width: 8,
    },
    tickFilled: {
      backgroundColor: colors.accentStrong,
      shadowColor: colors.accentStrong,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.28,
      shadowRadius: 6,
    },
    marker: {
      borderRadius: 999,
      borderWidth: 2,
      height: 12,
      position: "absolute",
      width: 12,
    },
    markerPeriod: {
      backgroundColor: colors.calendarPeriodBg,
      borderColor: colors.calendarPeriodBorder,
    },
    markerFertile: {
      backgroundColor: colors.calendarFertilityEdgeBg,
      borderColor: colors.calendarFertilityEdgeBorder,
    },
    markerOvulation: {
      backgroundColor: colors.calendarOvulationBg,
      borderColor: colors.calendarOvulationBorder,
    },
    currentDot: {
      borderRadius: 999,
      borderWidth: 2,
      height: 14,
      position: "absolute",
      width: 14,
    },
    currentDotActive: {
      backgroundColor: colors.accentStrong,
      borderColor: colors.surface,
      shadowColor: colors.accentStrong,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.36,
      shadowRadius: 8,
    },
    currentDotApproximate: {
      backgroundColor: colors.accent,
      borderColor: colors.surface,
      shadowColor: colors.accent,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.28,
      shadowRadius: 8,
    },
    centerCard: {
      alignItems: "center",
      backgroundColor: colors.surface,
      borderColor: colors.lineSoft,
      borderWidth: 1,
      gap: 2,
      justifyContent: "center",
      paddingHorizontal: spacing.md,
    },
    centerIcon: {
      color: colors.accentStrong,
      fontSize: 18,
      lineHeight: 20,
    },
    centerTitle: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: "700",
      textAlign: "center",
      textTransform: "uppercase",
    },
    centerValue: {
      color: colors.text,
      fontSize: 24,
      fontWeight: "800",
      lineHeight: 30,
      textAlign: "center",
    },
    centerDetail: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: "600",
      lineHeight: 17,
      textAlign: "center",
    },
    caption: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "700",
      textAlign: "center",
    },
    legendRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
      justifyContent: "center",
    },
    legendItem: {
      alignItems: "center",
      backgroundColor: colors.surfaceTint,
      borderColor: colors.lineSoft,
      borderRadius: 999,
      borderWidth: 1,
      flexDirection: "row",
      gap: 8,
      paddingHorizontal: 10,
      paddingVertical: 7,
    },
    legendDot: {
      borderRadius: 999,
      borderWidth: 1,
      height: 10,
      width: 10,
    },
    legendText: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: "700",
    },
  });
