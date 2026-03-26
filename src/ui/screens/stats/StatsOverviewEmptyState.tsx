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
          <View style={styles.emptyGrid}>
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
