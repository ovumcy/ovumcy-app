import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { StatsViewData } from "../../services/stats-view-service";
import { FeatureCard } from "../components/FeatureCard";
import { StatsBarChart } from "../components/StatsBarChart";
import type { AppThemeColors } from "../theme/tokens";
import { spacing } from "../theme/tokens";
import { useAppTheme, useThemedStyles } from "../theme/useThemedStyles";

type StatsOverviewScreenProps = {
  viewData: StatsViewData;
};

export function StatsOverviewScreen({ viewData }: StatsOverviewScreenProps) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const cardColumns = width >= 1080 ? 4 : width >= 760 ? 2 : 1;
  const cardWidth =
    cardColumns === 4 ? "23.5%" : cardColumns === 2 ? "48.5%" : "100%";
  const pairWidth = width >= 920 ? "48.5%" : "100%";
  const trendPrimaryWidth = width >= 1080 ? "65.5%" : "100%";
  const trendSecondaryWidth = width >= 1080 ? "32.5%" : "100%";

  return (
    <ScrollView
      contentContainerStyle={[
        styles.screenContent,
        { paddingBottom: Math.max(insets.bottom + 16, spacing.xl) },
      ]}
      showsVerticalScrollIndicator={false}
      style={styles.screen}
    >
      <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{viewData.title}</Text>
          <Text style={styles.headerDescription}>{viewData.description}</Text>
        </View>

        {!viewData.hasInsights && viewData.emptyState ? (
          <FeatureCard
            title={viewData.emptyState.title}
            description={viewData.emptyState.body}
          >
            <View style={styles.emptyHero} testID="stats-empty-hero">
              <View style={styles.emptyHeroCard}>
                <View style={[styles.emptyOrb, styles.emptyOrbPrimary]} />
                <View style={[styles.emptyOrb, styles.emptyOrbSecondary]} />
                <View style={styles.emptyGrid}>
                  {Array.from({ length: 6 }).map((_, index) => (
                    <View
                      key={String(index)}
                      style={[
                        styles.emptyCell,
                        index === 2 ? styles.emptyCellActive : null,
                        index === 4 ? styles.emptyCellSoft : null,
                      ]}
                    />
                  ))}
                </View>
              </View>
              <View style={styles.emptyNote}>
                <View style={styles.emptyNoteDot} />
                <View style={styles.emptyNoteLine} />
                <View style={[styles.emptyNoteLine, styles.emptyNoteLineShort]} />
              </View>
            </View>
            <View style={styles.progressBlock}>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${viewData.emptyState.progressPercent}%` },
                  ]}
                />
              </View>
              <Text style={styles.progressLabel}>
                {viewData.emptyState.progressLabel}
              </Text>
              <Text style={styles.helperText}>{viewData.emptyState.hint}</Text>
            </View>
          </FeatureCard>
        ) : null}

        {viewData.predictionExplanation ? (
          <View style={styles.noticePanel}>
            <Text style={styles.noticeText}>{viewData.predictionExplanation}</Text>
          </View>
        ) : null}

        {viewData.notices.map((notice) => (
          <View key={notice} style={styles.noticePanel}>
            <Text style={styles.noticeText}>{notice}</Text>
          </View>
        ))}

        {viewData.hasInsights ? (
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
              title={viewData.factorContext.title}
              description={viewData.factorContext.description}
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
                        <Text style={styles.helperText}>
                          {cycle.comparisonLabel}
                        </Text>
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

          <View style={styles.sectionGrid}>
            {viewData.lastCycleSymptoms ? (
              <View style={{ width: pairWidth }}>
                <FeatureCard
                  title={viewData.lastCycleSymptoms.title}
                  description={viewData.lastCycleSymptoms.subtitle}
                  testID="stats-last-cycle-symptoms"
                >
                  {viewData.lastCycleSymptoms.items.length > 0 ? (
                    <View style={styles.listStack}>
                      {viewData.lastCycleSymptoms.items.map((item) => (
                        <SymptomRow
                          key={item.id}
                          frequencySummary={item.frequencySummary}
                          icon={item.icon}
                          label={item.label}
                          styles={styles}
                        />
                      ))}
                    </View>
                  ) : (
                    <InsightEmptyState
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
                  title={viewData.bbtTrend.title}
                  description={viewData.bbtTrend.caption}
                  testID="stats-bbt-trend"
                >
                  <StatsBarChart
                    accentColor={colors.accentSecondary}
                    emptyLabel={viewData.trendChart?.emptyLabel ?? ""}
                    points={viewData.bbtTrend.points}
                    scaleMode="range"
                    testID="stats-bbt-chart"
                    valueDecimals={1}
                    valueSuffix={` ${viewData.bbtTrend.unitLabel}`}
                  />
                </FeatureCard>
              </View>
            ) : null}
          </View>

          <View style={styles.sectionGrid}>
            {viewData.trendChart ? (
              <View style={{ width: trendPrimaryWidth }}>
                <FeatureCard
                  title={viewData.trendChart.title}
                  testID="stats-trend-section"
                >
                  <View style={styles.legendRow}>
                    <View style={styles.legendItem}>
                      <View
                        style={[styles.legendDot, styles.legendDotActual]}
                      />
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
                  title={viewData.symptomFrequency.title}
                  testID="stats-symptom-frequency"
                >
                  {viewData.symptomFrequency.items.length > 0 ? (
                    <View style={styles.listStack}>
                      {viewData.symptomFrequency.items.map((item) => (
                        <SymptomRow
                          key={item.id}
                          frequencySummary={item.frequencySummary}
                          icon={item.icon}
                          label={item.label}
                          styles={styles}
                        />
                      ))}
                    </View>
                  ) : (
                    <InsightEmptyState
                      icon="🧾"
                      label={viewData.symptomFrequency.emptyLabel}
                      styles={styles}
                    />
                  )}
                </FeatureCard>
              </View>
            ) : null}
          </View>

          {viewData.symptomPatterns && viewData.symptomPatterns.items.length > 0 ? (
            <FeatureCard
              title={viewData.symptomPatterns.title}
              description={viewData.symptomPatterns.subtitle}
              testID="stats-symptom-patterns"
            >
              <View style={styles.sectionGrid}>
                {viewData.symptomPatterns.items.map((item) => (
                  <View key={item.id} style={[styles.panel, { width: pairWidth }]}>
                    <View style={styles.metaRow}>
                      <Text style={styles.metaIcon}>{item.icon}</Text>
                      <Text style={styles.metaLabel}>{item.label}</Text>
                    </View>
                    <Text style={styles.helperText}>{item.summary}</Text>
                  </View>
                ))}
              </View>
            </FeatureCard>
          ) : null}

          {hasAnyPhaseInsights(viewData) ? (
            <View style={styles.sectionGrid}>
              {viewData.phaseMoodInsights &&
              viewData.phaseMoodInsights.items.some((item) => item.hasData) ? (
                <View style={{ width: pairWidth }}>
                  <FeatureCard
                    title={viewData.phaseMoodInsights.title}
                    description={viewData.phaseMoodInsights.subtitle}
                    testID="stats-phase-mood"
                  >
                    <View style={styles.sectionGrid}>
                      {viewData.phaseMoodInsights.items.map((item) => (
                        <View
                          key={item.key}
                          style={[styles.panel, { width: pairWidth }]}
                        >
                          <View style={styles.metaRow}>
                            <Text style={styles.metaIcon}>{item.icon}</Text>
                            <Text style={styles.metaLabel}>{item.phase}</Text>
                          </View>
                          {item.hasData ? (
                            <>
                              <View style={styles.meterTrack}>
                                <View
                                  style={[
                                    styles.meterFill,
                                    { width: `${item.percentage}%` },
                                  ]}
                                />
                              </View>
                              <Text style={styles.rowValue}>{item.averageMood}</Text>
                              <Text style={styles.helperText}>
                                {item.countLabel}
                              </Text>
                            </>
                          ) : (
                            <Text style={styles.helperText}>{item.emptyLabel}</Text>
                          )}
                        </View>
                      ))}
                    </View>
                  </FeatureCard>
                </View>
              ) : null}

              {viewData.phaseSymptomInsights &&
              viewData.phaseSymptomInsights.items.some((item) => item.hasData) ? (
                <View style={{ width: pairWidth }}>
                  <FeatureCard
                    title={viewData.phaseSymptomInsights.title}
                    description={viewData.phaseSymptomInsights.subtitle}
                    testID="stats-phase-symptoms"
                  >
                    <View style={styles.listStack}>
                      {viewData.phaseSymptomInsights.items.map((item) => (
                        <View key={item.key} style={styles.panel}>
                          <View style={styles.metaRow}>
                            <Text style={styles.metaIcon}>{item.icon}</Text>
                            <Text style={styles.metaLabel}>{item.phase}</Text>
                          </View>
                          {item.hasData ? (
                            <>
                              <View style={styles.listStack}>
                                {item.symptoms.map((symptom) => (
                                  <SymptomRow
                                    key={symptom.id}
                                    frequencySummary={symptom.percentageLabel}
                                    icon={symptom.icon}
                                    label={symptom.label}
                                    styles={styles}
                                  />
                                ))}
                              </View>
                              <Text style={styles.helperText}>
                                {item.totalDaysLabel}
                              </Text>
                            </>
                          ) : (
                            <Text style={styles.helperText}>{item.emptyLabel}</Text>
                          )}
                        </View>
                      ))}
                    </View>
                  </FeatureCard>
                </View>
              ) : null}
            </View>
          ) : null}
          </>
        ) : null}
      </View>
    </ScrollView>
  );
}

function InsightEmptyState({
  icon,
  label,
  styles,
}: {
  icon: string;
  label: string;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyStateIcon}>{icon}</Text>
      <Text style={styles.helperText}>{label}</Text>
    </View>
  );
}

function SymptomRow({
  frequencySummary,
  icon,
  label,
  styles,
}: {
  frequencySummary: string;
  icon: string;
  label: string;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.symptomRow}>
      <View style={styles.metaRow}>
        <Text style={styles.metaIcon}>{icon}</Text>
        <Text style={styles.metaLabel}>{label}</Text>
      </View>
      <Text style={styles.helperText}>{frequencySummary}</Text>
    </View>
  );
}

function hasAnyPhaseInsights(viewData: StatsViewData): boolean {
  return Boolean(
    viewData.phaseMoodInsights?.items.some((item) => item.hasData) ||
      viewData.phaseSymptomInsights?.items.some((item) => item.hasData),
  );
}

const createStyles = (colors: AppThemeColors) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.background,
    },
    screenContent: {
      paddingBottom: spacing.xl,
    },
    container: {
      alignSelf: "center",
      gap: spacing.md,
      maxWidth: 1080,
      paddingHorizontal: 16,
      paddingTop: 16,
      width: "100%",
    },
    header: {
      gap: 6,
    },
    headerTitle: {
      color: colors.text,
      fontSize: 29,
      fontWeight: "800",
      lineHeight: 34,
    },
    headerDescription: {
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 21,
    },
    emptyHero: {
      alignItems: "center",
      gap: spacing.md,
    },
    emptyHeroCard: {
      alignItems: "center",
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.border,
      borderRadius: 22,
      borderWidth: 1,
      overflow: "hidden",
      padding: 20,
      width: "100%",
    },
    emptyOrb: {
      borderRadius: 999,
      position: "absolute",
    },
    emptyOrbPrimary: {
      backgroundColor: colors.accentSoft,
      height: 72,
      right: -8,
      top: -12,
      width: 72,
    },
    emptyOrbSecondary: {
      backgroundColor: colors.surface,
      height: 56,
      left: -12,
      top: 34,
      width: 56,
    },
    emptyGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
      justifyContent: "center",
      maxWidth: 212,
    },
    emptyCell: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 16,
      borderWidth: 1,
      height: 44,
      width: 60,
    },
    emptyCellActive: {
      backgroundColor: colors.accentSoft,
      borderColor: colors.accentStrong,
    },
    emptyCellSoft: {
      opacity: 0.72,
    },
    emptyNote: {
      alignItems: "center",
      gap: 6,
    },
    emptyNoteDot: {
      backgroundColor: colors.accentStrong,
      borderRadius: 999,
      height: 8,
      width: 8,
    },
    emptyNoteLine: {
      backgroundColor: colors.border,
      borderRadius: 999,
      height: 6,
      width: 112,
    },
    emptyNoteLineShort: {
      width: 72,
    },
    progressBlock: {
      gap: spacing.sm,
    },
    progressTrack: {
      backgroundColor: colors.surfaceMuted,
      borderRadius: 999,
      height: 10,
      overflow: "hidden",
    },
    progressFill: {
      backgroundColor: colors.accentStrong,
      borderRadius: 999,
      height: "100%",
    },
    progressLabel: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: "700",
    },
    noticePanel: {
      backgroundColor: colors.surfaceStrong,
      borderColor: colors.border,
      borderRadius: 16,
      borderWidth: 1,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    noticeText: {
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 21,
    },
    cardGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.md,
    },
    statCard: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 16,
      borderWidth: 1,
      gap: spacing.xs,
      padding: 16,
    },
    cardLabel: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: "700",
    },
    cardValue: {
      color: colors.text,
      fontSize: 24,
      fontWeight: "800",
      lineHeight: 30,
    },
    cardDescription: {
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 20,
    },
    overviewGrid: {
      gap: spacing.md,
    },
    panel: {
      backgroundColor: colors.surfaceMuted,
      borderRadius: 14,
      gap: spacing.sm,
      padding: 14,
    },
    row: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.sm,
      justifyContent: "space-between",
    },
    rowLabel: {
      color: colors.textMuted,
      fontSize: 14,
      fontWeight: "600",
    },
    rowValue: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "700",
    },
    chipRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
    },
    factorChip: {
      backgroundColor: colors.surfaceStrong,
      borderColor: colors.border,
      borderRadius: 999,
      borderWidth: 1,
      paddingHorizontal: spacing.sm,
      paddingVertical: 10,
    },
    factorChipText: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "600",
    },
    patternGrid: {
      gap: spacing.md,
    },
    recentCycleList: {
      gap: spacing.md,
    },
    helperText: {
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 20,
    },
    sectionGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.md,
    },
    listStack: {
      gap: spacing.sm,
    },
    symptomRow: {
      alignItems: "center",
      backgroundColor: colors.surfaceMuted,
      borderRadius: 14,
      flexDirection: "row",
      gap: spacing.sm,
      justifyContent: "space-between",
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    metaRow: {
      alignItems: "center",
      flexDirection: "row",
      flexShrink: 1,
      gap: spacing.sm,
    },
    metaIcon: {
      fontSize: 16,
    },
    metaLabel: {
      color: colors.text,
      flexShrink: 1,
      fontSize: 14,
      fontWeight: "700",
    },
    emptyState: {
      alignItems: "center",
      gap: spacing.sm,
      paddingVertical: spacing.md,
    },
    emptyStateIcon: {
      fontSize: 22,
    },
    legendRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.md,
    },
    legendItem: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.xs,
    },
    legendDot: {
      borderRadius: 4,
      height: 10,
      width: 10,
    },
    legendDotActual: {
      backgroundColor: colors.accentStrong,
    },
    legendLine: {
      borderColor: colors.textMuted,
      borderStyle: "dashed",
      borderTopWidth: 2,
      opacity: 0.6,
      width: 24,
    },
    meterTrack: {
      backgroundColor: colors.surfaceStrong,
      borderRadius: 999,
      height: 10,
      overflow: "hidden",
    },
    meterFill: {
      backgroundColor: colors.accentStrong,
      borderRadius: 999,
      height: "100%",
    },
  });
