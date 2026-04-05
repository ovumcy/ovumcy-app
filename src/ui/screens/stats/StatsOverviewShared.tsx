import { Text, View } from "react-native";

import type { StatsOverviewStyles } from "./stats-overview-styles";

type StatsOverviewInsightEmptyStateProps = {
  icon: string;
  label: string;
  styles: StatsOverviewStyles;
};

type StatsOverviewSymptomRowProps = {
  frequencySummary: string;
  icon: string;
  label: string;
  styles: StatsOverviewStyles;
};

export function StatsOverviewInsightEmptyState({
  icon,
  label,
  styles,
}: StatsOverviewInsightEmptyStateProps) {
  return (
    <View accessibilityLabel={label} accessible style={styles.emptyState}>
      <Text style={styles.emptyStateIcon}>{icon}</Text>
      <Text style={styles.helperText}>{label}</Text>
    </View>
  );
}

export function StatsOverviewSymptomRow({
  frequencySummary,
  icon,
  label,
  styles,
}: StatsOverviewSymptomRowProps) {
  return (
    <View
      accessibilityLabel={`${label}. ${frequencySummary}.`}
      accessible
      style={styles.symptomRow}
    >
      <View style={styles.metaRow}>
        <Text style={styles.metaIcon}>{icon}</Text>
        <Text style={styles.metaLabel}>{label}</Text>
      </View>
      <Text style={styles.helperText}>{frequencySummary}</Text>
    </View>
  );
}
