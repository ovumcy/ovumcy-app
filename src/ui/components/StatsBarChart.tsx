import { StyleSheet, Text, View } from "react-native";

import type { AppThemeColors } from "../theme/tokens";
import { spacing } from "../theme/tokens";
import { useAppTheme, useThemedStyles } from "../theme/useThemedStyles";

export type StatsBarChartPoint = {
  key: string;
  label: string;
  value: number;
};

const BAR_TRACK_HEIGHT = 132;
const AXIS_LABEL_OFFSET = 28;
const CHART_PADDING = spacing.md;

type StatsBarChartProps = {
  accentColor?: string;
  baselineValue?: number | null;
  emptyLabel: string;
  points: StatsBarChartPoint[];
  scaleMode?: "range" | "zero";
  testID?: string;
  valueDecimals?: number;
  valueSuffix: string;
};

export function StatsBarChart({
  accentColor,
  baselineValue,
  emptyLabel,
  points,
  scaleMode = "zero",
  testID,
  valueDecimals = 0,
  valueSuffix,
}: StatsBarChartProps) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useAppTheme();
  const resolvedAccentColor = accentColor ?? colors.accentStrong;

  if (points.length === 0) {
    return (
      <Text style={styles.emptyLabel} testID={testID}>
        {emptyLabel}
      </Text>
    );
  }

  const values = points.map((point) => point.value);
  if (baselineValue !== null && baselineValue !== undefined) {
    values.push(baselineValue);
  }

  const { minValue, range } = resolveDomain(values, scaleMode);
  const baselineOffset =
    baselineValue !== null && baselineValue !== undefined
      ? CHART_PADDING +
        AXIS_LABEL_OFFSET +
        BAR_TRACK_HEIGHT *
          Math.min(Math.max((baselineValue - minValue) / range, 0), 1)
      : null;

  return (
    <View style={styles.wrapper} testID={testID}>
      <View style={styles.chartShell}>
        {baselineOffset ? (
          <View style={[styles.baseline, { bottom: baselineOffset }]} />
        ) : null}
        <View style={styles.columns}>
          {points.map((point) => {
            const height = Math.max(
              ((point.value - minValue) / range) * 100,
              6,
            );

            return (
              <View key={point.key} style={styles.column}>
                <Text style={styles.valueLabel}>
                  {formatValue(point.value, valueDecimals, valueSuffix)}
                </Text>
                <View style={styles.barTrack}>
                  <View
                    style={[
                        styles.bar,
                      {
                        backgroundColor: resolvedAccentColor,
                        height: `${Math.min(height, 100)}%`,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.axisLabel}>{point.label}</Text>
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}

function resolveDomain(
  values: number[],
  scaleMode: "range" | "zero",
): { maxValue: number; minValue: number; range: number } {
  const maxValue = Math.max(...values);

  if (scaleMode === "zero") {
    const paddedMax = Math.max(maxValue * 1.1, 1);
    return {
      maxValue: paddedMax,
      minValue: 0,
      range: paddedMax,
    };
  }

  const minValue = Math.min(...values);
  const rawRange = maxValue - minValue;
  const padding = Math.max(rawRange * 0.15, 0.12);
  const paddedMin = minValue - padding;
  const paddedMax = maxValue + padding;

  return {
    maxValue: paddedMax,
    minValue: paddedMin,
    range: Math.max(paddedMax - paddedMin, 1),
  };
}

function formatValue(
  value: number,
  decimals: number,
  valueSuffix: string,
): string {
  const formatted =
    decimals > 0 ? value.toFixed(decimals) : Math.round(value).toString();
  return `${formatted}${valueSuffix}`;
}

const createStyles = (colors: AppThemeColors) =>
  StyleSheet.create({
    wrapper: {
      gap: spacing.sm,
    },
    chartShell: {
      backgroundColor: colors.surfaceStrong,
      borderColor: colors.border,
      borderRadius: 16,
      borderWidth: 1,
      minHeight: 208,
      overflow: "hidden",
      padding: spacing.md,
      position: "relative",
    },
    baseline: {
      borderColor: colors.textMuted,
      borderStyle: "dashed",
      borderTopWidth: 1,
      left: spacing.md,
      opacity: 0.45,
      position: "absolute",
      right: spacing.md,
    },
    columns: {
      alignItems: "flex-end",
      flexDirection: "row",
      flexGrow: 1,
      gap: spacing.sm,
      height: "100%",
    },
    column: {
      alignItems: "center",
      flex: 1,
      gap: 6,
      justifyContent: "flex-end",
    },
    valueLabel: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: "700",
    },
    barTrack: {
      backgroundColor: colors.surfaceMuted,
      borderRadius: 999,
      justifyContent: "flex-end",
      overflow: "hidden",
      padding: 4,
      width: "100%",
      height: BAR_TRACK_HEIGHT,
    },
    bar: {
      borderRadius: 999,
      minHeight: 8,
      width: "100%",
    },
    axisLabel: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: "600",
      textAlign: "center",
    },
    emptyLabel: {
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 20,
    },
  });
