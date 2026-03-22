import { type DimensionValue, Text, View } from "react-native";

import type { StatsViewData } from "../../../services/stats-view-service";
import { FeatureCard } from "../../components/FeatureCard";
import type { StatsOverviewStyles } from "./stats-overview-styles";

type StatsOverviewSummarySectionsProps = {
  cardWidth: DimensionValue;
  styles: StatsOverviewStyles;
  viewData: StatsViewData;
};

export function StatsOverviewSummarySections({
  cardWidth,
  styles,
  viewData,
}: StatsOverviewSummarySectionsProps) {
  return (
    <>
      <View style={styles.cardGrid}>
        {viewData.topCards.map((card) => (
          <View key={card.key} style={[styles.statCard, { width: cardWidth }]}>
            <Text style={styles.cardLabel}>{card.title}</Text>
            <Text style={styles.cardValue}>{card.value}</Text>
            {card.description ? (
              <Text style={styles.cardDescription}>{card.description}</Text>
            ) : null}
          </View>
        ))}
      </View>

      {viewData.cycleOverview ? (
        <FeatureCard title={viewData.cycleOverview.title}>
          <View style={styles.overviewGrid}>
            <View style={styles.panel}>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>
                  {viewData.cycleOverview.averageLabel}
                </Text>
                <Text style={styles.rowValue}>
                  {viewData.cycleOverview.averageValue}
                </Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>
                  {viewData.cycleOverview.medianLabel}
                </Text>
                <Text style={styles.rowValue}>
                  {viewData.cycleOverview.medianValue}
                </Text>
              </View>
            </View>
            <View style={styles.panel}>
              <Text style={styles.cardLabel}>
                {viewData.cycleOverview.rangeTitle}
              </Text>
              <Text style={styles.cardValue}>
                {viewData.cycleOverview.rangeValue}
              </Text>
            </View>
          </View>
        </FeatureCard>
      ) : null}

      {viewData.factorContext ? (
        <FeatureCard
          description={viewData.factorContext.description}
          title={viewData.factorContext.title}
        >
          <View style={styles.chipRow} testID="stats-factor-context">
            {viewData.factorContext.recentFactors.map((item) => (
              <View key={item.key} style={styles.factorChip}>
                <Text style={styles.factorChipText}>
                  {item.icon} {item.label} · {item.count}
                </Text>
              </View>
            ))}
          </View>

          {viewData.factorContext.patternSummaries.length > 0 ? (
            <View style={styles.patternGrid}>
              {viewData.factorContext.patternSummaries.map((summary) => (
                <View key={summary.key} style={styles.panel}>
                  <Text style={styles.cardLabel}>{summary.title}</Text>
                  <View style={styles.chipRow}>
                    {summary.items.map((item) => (
                      <View key={item.key} style={styles.factorChip}>
                        <Text style={styles.factorChipText}>
                          {item.icon} {item.label} · {item.count}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          ) : null}

          {viewData.factorContext.recentCycles.length > 0 ? (
            <View style={styles.recentCycleList}>
              {viewData.factorContext.recentCycles.map((cycle) => (
                <View key={`${cycle.startDate}-${cycle.title}`} style={styles.panel}>
                  <View style={styles.row}>
                    <Text style={styles.cardLabel}>{cycle.title}</Text>
                    <Text style={styles.helperText}>{cycle.comparisonLabel}</Text>
                  </View>
                  <Text style={styles.helperText}>
                    {cycle.startDate} to {cycle.endDate}
                  </Text>
                  <View style={styles.chipRow}>
                    {cycle.factors.map((item) => (
                      <View key={item.key} style={styles.factorChip}>
                        <Text style={styles.factorChipText}>
                          {item.icon} {item.label}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          ) : null}

          <Text style={styles.helperText}>{viewData.factorContext.hint}</Text>
        </FeatureCard>
      ) : null}
    </>
  );
}
