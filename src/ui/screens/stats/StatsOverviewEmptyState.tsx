import { Text, View } from "react-native";

import type { StatsViewData } from "../../../services/stats-view-service";
import { AppButton } from "../../components/AppButton";
import { FeatureCard } from "../../components/FeatureCard";
import type { StatsOverviewStyles } from "./stats-overview-styles";

type StatsOverviewEmptyStateProps = {
  onPrimaryAction?: (() => void) | undefined;
  styles: StatsOverviewStyles;
  viewData: StatsViewData;
};

export function StatsOverviewEmptyState({
  onPrimaryAction,
  styles,
  viewData,
}: StatsOverviewEmptyStateProps) {
  const emptyState = viewData.emptyState;

  if (!emptyState) {
    return null;
  }

  return (
    <FeatureCard
      description={emptyState.body}
      title={emptyState.title}
    >
      <View style={styles.emptyHero} testID="stats-empty-hero">
        <View style={styles.emptyHeroCard}>
          <View style={[styles.emptyOrb, styles.emptyOrbPrimary]} />
          <View style={[styles.emptyOrb, styles.emptyOrbSecondary]} />
          {/* The skeleton cells are placeholder chrome, but each one names a
              section that unlocks later — that list is the point of the hero.
              Announced as one element so it reads as "here is what is coming"
              instead of five stray section names with blank boxes between
              them. */}
          <View
            accessibilityLabel={emptyState.lockedSections.join(". ")}
            accessible
            style={styles.emptyGrid}
          >
            {emptyState.lockedSections.map((sectionTitle, index) => (
              <View
                key={sectionTitle}
                style={[
                  styles.emptyCell,
                  index === 2 ? styles.emptyCellActive : null,
                  index === 4 ? styles.emptyCellSoft : null,
                ]}
              >
                <Text style={styles.emptyCellTitle}>{sectionTitle}</Text>
                <View style={styles.emptyCellLine} />
                <View style={[styles.emptyCellLine, styles.emptyCellLineShort]} />
              </View>
            ))}
          </View>
        </View>
        {/* Pure decoration: a dot and two rules standing in for a note. */}
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={styles.emptyNote}
        >
          <View style={styles.emptyNoteDot} />
          <View style={styles.emptyNoteLine} />
          <View style={[styles.emptyNoteLine, styles.emptyNoteLineShort]} />
        </View>
      </View>
      <View style={styles.progressBlock}>
        <View
          accessibilityLabel={emptyState.progressLabel}
          accessibilityRole="progressbar"
          accessibilityValue={{
            min: 0,
            max: 100,
            now: emptyState.progressPercent,
          }}
          accessible
          style={styles.progressTrack}
          testID="stats-empty-progress"
        >
          <View
            style={[
              styles.progressFill,
              { width: `${emptyState.progressPercent}%` },
            ]}
          />
        </View>
        <Text style={styles.progressLabel}>
          {emptyState.progressLabel}
        </Text>
        <Text style={styles.helperText}>{emptyState.hint}</Text>
        {onPrimaryAction ? (
          <AppButton
            label={emptyState.action.label}
            onPress={onPrimaryAction}
            testID="stats-empty-primary-action"
          />
        ) : null}
      </View>
    </FeatureCard>
  );
}
