import { Text, View } from "react-native";

import type { StatsViewData } from "../../../services/stats-view-service";
import { FeatureCard } from "../../components/FeatureCard";
import { composeStatsAccessibilityLabel } from "./StatsOverviewShared";
import type { StatsOverviewStyles } from "./stats-overview-styles";

type StatsOverviewCompletedCycleListSectionProps = {
  styles: StatsOverviewStyles;
  viewData: StatsViewData;
};

export function StatsOverviewCompletedCycleListSection({
  styles,
  viewData,
}: StatsOverviewCompletedCycleListSectionProps) {
  const list = viewData.completedCycleList;
  if (!list || list.rows.length === 0) {
    return null;
  }

  return (
    <FeatureCard
      description={list.subtitle}
      testID="stats-completed-cycle-list"
      title={list.title}
    >
      <View
        accessibilityLabel={list.title}
        accessibilityRole="list"
        style={styles.listStack}
      >
        {list.rows.map((row) => (
          <View
            accessibilityLabel={composeStatsAccessibilityLabel([
              row.title,
              row.cycleLengthLabel,
              row.periodLengthLabel,
            ])}
            accessible
            key={row.key}
            style={styles.panel}
            testID="stats-completed-cycle-row"
          >
            <Text style={styles.metaLabel}>{row.title}</Text>
            <Text style={styles.rowValue}>{row.cycleLengthLabel}</Text>
            <Text style={styles.helperText}>{row.periodLengthLabel}</Text>
          </View>
        ))}
      </View>
    </FeatureCard>
  );
}
