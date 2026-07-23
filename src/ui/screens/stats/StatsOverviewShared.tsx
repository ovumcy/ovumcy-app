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

/**
 * Joins the lines of one stats panel into a single spoken sentence.
 *
 * Every insight panel is a title plus a value plus a qualifier laid out as
 * separate <Text> nodes. Read individually they arrive as disconnected
 * fragments ("Average cycle", "29 days", "across 4 cycles"); read as one
 * element they are the sentence the panel is drawn to say.
 */
export function composeStatsAccessibilityLabel(
  parts: readonly (string | null | undefined)[],
): string {
  return parts
    .filter((value): value is string => Boolean(value && value.trim()))
    .join(". ");
}

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
