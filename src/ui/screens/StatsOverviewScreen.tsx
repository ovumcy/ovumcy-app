import { StyleSheet, Text, View } from "react-native";

import type { StatsViewData } from "../../services/stats-view-service";
import { FeatureCard } from "../components/FeatureCard";
import { ScreenScaffold } from "../components/ScreenScaffold";
import { colors, spacing } from "../theme/tokens";

type StatsOverviewScreenProps = {
  viewData: StatsViewData;
};

export function StatsOverviewScreen({ viewData }: StatsOverviewScreenProps) {
  return (
    <ScreenScaffold
      eyebrow={viewData.eyebrow}
      title={viewData.title}
      description={viewData.description}
    >
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
            <Text style={styles.progressLabel}>{viewData.emptyState.progressLabel}</Text>
            <Text style={styles.helperText}>{viewData.emptyState.hint}</Text>
          </View>
        </FeatureCard>
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
              <View key={card.key} style={styles.statCard}>
                <Text style={styles.cardLabel}>{card.title}</Text>
                <Text style={styles.cardValue}>{card.value}</Text>
                {card.description ? (
                  <Text style={styles.cardDescription}>{card.description}</Text>
                ) : null}
              </View>
            ))}
          </View>

          {viewData.cycleOverview ? (
            <FeatureCard
              title={viewData.cycleOverview.title}
              description="Built from your completed local cycle history."
            >
              <View style={styles.overviewGrid}>
                <View style={styles.panel}>
                  <View style={styles.row}>
                    <Text style={styles.rowLabel}>{viewData.cycleOverview.averageLabel}</Text>
                    <Text style={styles.rowValue}>{viewData.cycleOverview.averageValue}</Text>
                  </View>
                  <View style={styles.row}>
                    <Text style={styles.rowLabel}>{viewData.cycleOverview.medianLabel}</Text>
                    <Text style={styles.rowValue}>{viewData.cycleOverview.medianValue}</Text>
                  </View>
                </View>
                <View style={styles.panel}>
                  <Text style={styles.cardLabel}>{viewData.cycleOverview.rangeTitle}</Text>
                  <Text style={styles.cardValue}>{viewData.cycleOverview.rangeValue}</Text>
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
      ) : null}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  emptyHero: {
    alignItems: "center",
    gap: spacing.md,
  },
  emptyHeroCard: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 28,
    borderWidth: 1,
    overflow: "hidden",
    padding: spacing.lg,
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
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  noticeText: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
  },
  cardGrid: {
    gap: spacing.md,
  },
  statCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 24,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.lg,
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
    borderRadius: 18,
    gap: spacing.sm,
    padding: spacing.md,
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
});
