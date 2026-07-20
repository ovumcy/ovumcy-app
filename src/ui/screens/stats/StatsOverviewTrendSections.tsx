import { type DimensionValue, Text, View } from "react-native";

import type { StatsViewData } from "../../../services/stats-view-service";
import { FeatureCard } from "../../components/FeatureCard";
import { StatsBarChart } from "../../components/StatsBarChart";
import type { AppThemeColors } from "../../theme/tokens";
import {
  StatsOverviewInsightEmptyState,
  StatsOverviewSymptomRow,
} from "./StatsOverviewShared";
import type { StatsOverviewStyles } from "./stats-overview-styles";

type StatsOverviewTrendSectionsProps = {
  colors: AppThemeColors;
  pairWidth: DimensionValue;
  styles: StatsOverviewStyles;
  trendPrimaryWidth: DimensionValue;
  trendSecondaryWidth: DimensionValue;
  viewData: StatsViewData;
};

export function StatsOverviewTrendSections({
  colors,
  pairWidth,
  styles,
  trendPrimaryWidth,
  trendSecondaryWidth,
  viewData,
}: StatsOverviewTrendSectionsProps) {
  return (
    <>
      <View style={styles.sectionGrid}>
        {viewData.lastCycleSymptoms ? (
          <View style={{ width: pairWidth }}>
            <FeatureCard
              description={viewData.lastCycleSymptoms.subtitle}
              testID="stats-last-cycle-symptoms"
              title={viewData.lastCycleSymptoms.title}
            >
              {viewData.lastCycleSymptoms.items.length > 0 ? (
                <View style={styles.listStack}>
                  {viewData.lastCycleSymptoms.items.map((item) => (
                    <StatsOverviewSymptomRow
                      key={item.id}
                      frequencySummary={item.frequencySummary}
                      icon={item.icon}
                      label={item.label}
                      styles={styles}
                    />
                  ))}
                </View>
              ) : (
                <StatsOverviewInsightEmptyState
                  icon="🧾"
                  label={viewData.lastCycleSymptoms.emptyLabel}
                  styles={styles}
                />
              )}
            </FeatureCard>
          </View>
        ) : null}

        {viewData.bbtTrend ? (
          <View style={{ width: pairWidth }}>
            <FeatureCard
              description={viewData.bbtTrend.caption}
              testID="stats-bbt-trend"
              title={viewData.bbtTrend.title}
            >
              {viewData.bbtTrend.coverlineValue !== null ? (
                <View style={styles.legendRow}>
                  <View style={styles.legendItem}>
                    <View style={styles.legendLine} />
                    <Text style={styles.helperText}>
                      {viewData.bbtTrend.coverlineLabel}
                    </Text>
                  </View>
                </View>
              ) : null}
              <StatsBarChart
                accentColor={colors.accentSecondary}
                accessibilityLabel={buildChartAccessibilityLabel(
                  viewData.bbtTrend.title,
                  viewData.bbtTrend.points,
                  ` ${viewData.bbtTrend.unitLabel}`,
                  viewData.bbtTrend.coverlineValue,
                  viewData.bbtTrend.coverlineLabel,
                )}
                baselineValue={viewData.bbtTrend.coverlineValue}
                emptyLabel={viewData.trendChart?.emptyLabel ?? ""}
                points={viewData.bbtTrend.points}
                scaleMode="range"
                testID="stats-bbt-chart"
                valueDecimals={1}
                valueSuffix={` ${viewData.bbtTrend.unitLabel}`}
              />
              {viewData.bbtTrend.probableOvulationLabel ? (
                <Text
                  style={styles.helperText}
                  testID="stats-bbt-probable-ovulation"
                >
                  {viewData.bbtTrend.probableOvulationLabel}
                </Text>
              ) : null}
            </FeatureCard>
          </View>
        ) : null}
      </View>

      <View style={styles.sectionGrid}>
        {viewData.trendChart ? (
          <View style={{ width: trendPrimaryWidth }}>
            <FeatureCard
              testID="stats-trend-section"
              title={viewData.trendChart.title}
            >
              <View style={styles.legendRow}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, styles.legendDotActual]} />
                  <Text style={styles.helperText}>
                    {viewData.trendChart.legendActualLabel}
                  </Text>
                </View>
                {viewData.trendChart.baselineValue !== null ? (
                  <View style={styles.legendItem}>
                    <View style={styles.legendLine} />
                    <Text style={styles.helperText}>
                      {viewData.trendChart.legendAverageLabel}
                    </Text>
                  </View>
                ) : null}
              </View>
              <StatsBarChart
                accessibilityLabel={buildChartAccessibilityLabel(
                  viewData.trendChart.title,
                  viewData.trendChart.points,
                  ` ${viewData.trendChart.valueSuffix}`,
                  viewData.trendChart.baselineValue,
                  viewData.trendChart.legendAverageLabel,
                )}
                baselineValue={viewData.trendChart.baselineValue}
                emptyLabel={viewData.trendChart.emptyLabel}
                points={viewData.trendChart.points}
                testID="stats-trend-chart"
                valueSuffix={` ${viewData.trendChart.valueSuffix}`}
              />
            </FeatureCard>
          </View>
        ) : null}

        {viewData.symptomFrequency ? (
          <View style={{ width: trendSecondaryWidth }}>
            <FeatureCard
              testID="stats-symptom-frequency"
              title={viewData.symptomFrequency.title}
            >
              {viewData.symptomFrequency.items.length > 0 ? (
                <View style={styles.listStack}>
                  {viewData.symptomFrequency.items.map((item) => (
                    <StatsOverviewSymptomRow
                      key={item.id}
                      frequencySummary={item.frequencySummary}
                      icon={item.icon}
                      label={item.label}
                      styles={styles}
                    />
                  ))}
                </View>
              ) : (
                <StatsOverviewInsightEmptyState
                  icon="🧾"
                  label={viewData.symptomFrequency.emptyLabel}
                  styles={styles}
                />
              )}
            </FeatureCard>
          </View>
        ) : null}
      </View>
    </>
  );
}

function buildChartAccessibilityLabel(
  title: string,
  points: {
    label: string;
    value: number;
  }[],
  valueSuffix: string,
  baselineValue?: number | null,
  baselineLabel?: string,
): string {
  const pointSummary =
    points.length > 0
      ? points
          .map((point) => `${point.label}: ${point.value}${valueSuffix}`)
          .join(". ")
      : "";
  const baselineSummary =
    baselineValue !== null && baselineValue !== undefined && baselineLabel
      ? `${baselineLabel}: ${baselineValue}${valueSuffix}.`
      : "";

  return [title, baselineSummary, pointSummary]
    .filter((value) => value.trim().length > 0)
    .join(" ");
}
